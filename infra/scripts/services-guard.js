const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const COMPOSE_FILE = path.join(__dirname, "..", "compose.yaml");
const OWNER_LOCKFILE = path.join(__dirname, "..", "..", ".services-owner");
const CONTAINERS = ["postgres-dev", "mailcatcher-dev"];

function isContainerRunning(name) {
  try {
    const output = execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return output === "true";
  } catch {
    return false;
  }
}

function allContainersRunning() {
  return CONTAINERS.every(isContainerRunning);
}

function up() {
  const alreadyUp = allContainersRunning();

  execFileSync("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { stdio: "inherit" });

  if (alreadyUp) {
    console.log("\n🟢 Serviços já estavam ativos (reaproveitando de outra sessão).\n");
    return;
  }

  fs.writeFileSync(OWNER_LOCKFILE, new Date().toISOString());
  console.log("\n🟢 Serviços iniciados por esta sessão.\n");
}

function stop() {
  if (!fs.existsSync(OWNER_LOCKFILE)) {
    console.log(
      "\n🟡 Serviços não foram iniciados por esta sessão — mantendo ativos para não afetar outra sessão em uso.\n",
    );
    return;
  }

  fs.unlinkSync(OWNER_LOCKFILE);
  execFileSync("docker", ["compose", "-f", COMPOSE_FILE, "stop"], { stdio: "inherit" });
  console.log("\n🟢 Serviços parados (esta sessão era a dona).\n");
}

const command = process.argv[2];

if (command === "up") {
  up();
} else if (command === "stop") {
  stop();
} else {
  console.error("Uso: node infra/scripts/services-guard.js <up|stop>");
  process.exit(1);
}
