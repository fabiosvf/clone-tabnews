const { spawn } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const treeKill = require("tree-kill");

const PORT = Number(process.env.PORT) || 3000;
const LOCKFILE = path.join(__dirname, "..", "..", ".next-dev.pid");
const NEXT_BIN = require.resolve("next/dist/bin/next");

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "0.0.0.0");
  });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killTree(pid) {
  return new Promise((resolve) => {
    treeKill(pid, "SIGTERM", () => resolve());
  });
}

function readLockedPid() {
  if (!fs.existsSync(LOCKFILE)) return null;
  const pid = Number(fs.readFileSync(LOCKFILE, "utf8").trim());
  return Number.isInteger(pid) ? pid : null;
}

function writeLockedPid(pid) {
  fs.writeFileSync(LOCKFILE, String(pid));
}

function clearLockedPid() {
  if (fs.existsSync(LOCKFILE)) fs.unlinkSync(LOCKFILE);
}

async function waitPortFree(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortFree(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function ensurePortAvailable() {
  if (await isPortFree(PORT)) {
    clearLockedPid();
    return;
  }

  const lockedPid = readLockedPid();

  if (lockedPid && isProcessAlive(lockedPid)) {
    console.warn(
      `\n🟡 Porta ${PORT} ocupada por uma instância anterior desta aplicação (PID ${lockedPid}). Encerrando...`,
    );
    await killTree(lockedPid);
    const freed = await waitPortFree(PORT, 5000);
    clearLockedPid();

    if (!freed) {
      console.error(
        `\n🔴 Não foi possível liberar a porta ${PORT} automaticamente. Feche o processo manualmente e tente novamente.\n`,
      );
      process.exit(1);
    }
    return;
  }

  console.error(
    `\n🔴 A porta ${PORT} já está em uso por um processo não reconhecido por esta aplicação.\n` +
      `   Feche o que estiver usando a porta ${PORT} e tente novamente.\n`,
  );
  process.exit(1);
}

async function main() {
  await ensurePortAvailable();

  const child = spawn(process.execPath, [NEXT_BIN, "dev", "-p", String(PORT)], {
    stdio: "inherit",
  });

  writeLockedPid(child.pid);

  const cleanupAndExit = (code) => {
    clearLockedPid();
    process.exit(code ?? 0);
  };

  child.on("exit", (code) => cleanupAndExit(code));

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      killTree(child.pid).finally(() => cleanupAndExit(0));
    });
  }
}

main();
