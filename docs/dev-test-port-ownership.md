# Coexistência de `npm run dev` e `npm test` na porta 3000

## Problema original

Ao migrar o desenvolvimento do GitHub Codespaces para a WSL local, passaram
a ocorrer conflitos: `npm run dev` e `npm test` cada um tentava subir seu
próprio servidor Next.js. Quando a porta 3000 já estava ocupada (por um
processo anterior que ficou "fantasma" — o terminal foi fechado sem encerrar
o processo filho), o Next.js simplesmente subia em 3001, 3002, etc., o que
quebrava os testes de integração (que assumem porta fixa) e confundia qual
servidor estava realmente respondendo.

Depois, ao resolver isso, surgiu um segundo problema: rodar `npm test`
enquanto `npm run dev` já estava ativo matava o servidor de dev (o
desenvolvedor perde os `console.log` que estava observando), e o inverso
também acontecia — qualquer um dos dois comandos, rodado em qualquer ordem,
precisava conviver com o outro sem derrubá-lo.

## Requisitos definidos

1. A aplicação **sempre** sobe na porta 3000 — nunca faz fallback silencioso
   para outra porta.
2. Se a porta 3000 já estiver ocupada por uma instância **fantasma desta
   mesma aplicação**, o processo antigo é encerrado automaticamente e um
   novo é iniciado no lugar (comportamento do `npm run dev`).
3. Se a porta 3000 estiver ocupada por **qualquer processo não reconhecido**
   (algo externo ao projeto), o sistema se recusa a agir sobre ele e apenas
   informa o conflito — nunca mata um processo que não tem certeza de ter
   sido criado por esta aplicação.
4. `npm run dev` e `npm test`, rodados em qualquer ordem, devem **reaproveitar**
   um servidor Next já ativo em vez de brigar por ele — só quem criou o
   servidor tem permissão de encerrá-lo.
5. O mesmo vale para os serviços de Docker (Postgres e Mailcatcher): só a
   sessão que efetivamente os iniciou deve poder pará-los ao final.
6. Tudo isso deve funcionar de forma transparente tanto em Linux/WSL quanto
   em Windows, sem depender de comandos de shell específicos de um SO
   (`ps`, `kill`, `taskkill`, etc.).

## Por que não dava pra usar comandos de shell diretamente

Uma primeira ideia seria rodar `lsof -i :3000` ou `netstat` num script
`.sh`/`.ps1` para achar e matar o processo pela porta. Isso foi descartado
porque:

- os comandos e suas saídas diferem entre Linux e Windows (`taskkill` vs.
  `kill`), exigindo lógica duplicada por SO;
- não haveria como distinguir com segurança "isso é um processo desta
  aplicação" de "isso é outro programa qualquer usando a porta 3000" — só
  a porta ocupada não prova posse.

A solução ficou inteiramente em Node.js puro (módulos `node:net`,
`node:child_process`, `node:fs`) mais um único pacote cross-platform
(`tree-kill`), que internamente já resolve a diferença Windows/Unix
(usa `taskkill /T /F` no Windows e sinais recursivos no Unix).

## Como a posse é rastreada: arquivo de lock com PID

O mecanismo central é um arquivo de lock (`.next-dev.pid`, na raiz do
projeto, ignorado pelo Git) que guarda o PID do processo Next que está
efetivamente servindo a porta 3000. A posse é verificada por dois fatores
combinados, não só pela porta estar ocupada:

1. **A porta 3000 está mesmo ocupada?** — testado tentando abrir um
   `net.createServer()` nela; se falhar, está ocupada.
2. **O PID salvo no lockfile ainda está vivo?** — verificado com
   `process.kill(pid, 0)`. Esse é um recurso do Node.js: passar o sinal
   `0` não mata ninguém, só testa se o processo existe e se temos permissão
   sobre ele (lança exceção se não existir). Funciona igual em Windows e
   Unix.

Só quando **as duas condições batem** (porta ocupada **e** o PID do lock
ainda está vivo) é que o processo é tratado como "uma instância fantasma
desta aplicação". Se a porta está ocupada mas o lockfile não existe, está
desatualizado, ou aponta para um PID morto, o processo que a estiver usando
é tratado como **desconhecido** — e nesse caso o sistema se recusa a agir
(requisito 3):

```js
function refuseForeignProcess() {
  console.error(
    `\n🔴 A porta ${PORT} já está em uso por um processo não reconhecido por esta aplicação.\n` +
      `   Feche o que estiver usando a porta ${PORT} e tente novamente.\n`,
  );
  process.exit(1);
}
```

Esse é o ponto mais importante do design: **a aplicação nunca mata algo que
não consiga provar que foi ela mesma que criou.**

## `infra/scripts/next-dev-guarded.js` — o wrapper do `next dev`

Todo o `npm run dev` e o `npm test` passam por este script em vez de chamar
`next dev` diretamente. Ele decide o que fazer com base numa árvore de
decisão:

| Porta 3000 | Lock aponta pra processo vivo?             | Ação                                                                                 |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Livre      | —                                          | Sobe um `next dev` novo e grava o PID no lock                                        |
| Ocupada    | Não (lock ausente/morto/de outro programa) | Recusa e orienta o usuário a liberar a porta manualmente                             |
| Ocupada    | Sim, e modo `exclusive` (`npm run dev`)    | Mata a árvore do processo antigo (`tree-kill`), espera a porta liberar, sobe um novo |
| Ocupada    | Sim, e modo `reuse` (`npm test`)           | Não mata nada — apenas "gruda" no processo existente e aguarda                       |

O modo é escolhido pela flag `--mode=reuse`, usada só no script de `test`:

```json
"dev":  "... node infra/scripts/next-dev-guarded.js",
"test": "... \"node infra/scripts/next-dev-guarded.js --mode=reuse\" ..."
```

Ou seja: **`npm run dev` sempre tem prioridade de posse** (ele é o modo
"exclusivo" — se encontrar uma instância fantasma, tem permissão de
encerrá-la e assumir a porta). **`npm test` nunca mata um servidor
existente** — se a porta já está sendo servida por esta aplicação, ele
apenas reaproveita e espera; se não houver nada rodando, ele mesmo sobe um
servidor Next (também em modo reuse, para que uma segunda execução de
`npm test` em paralelo também reaproveite o dele).

### Detalhe técnico: por que o binário do `next` é resolvido via `require.resolve`

```js
const NEXT_BIN = require.resolve("next/dist/bin/next");
```

Em vez de `spawn("next", [...])`, o script resolve o caminho real do
binário do pacote `next` instalado localmente. Rodar `spawn("next", ...)`
depende do `next` estar no `PATH` do shell no momento — o que falha
(`ENOENT`) quando o script é chamado fora do fluxo do `npm run` (que injeta
`node_modules/.bin` no `PATH`), e é uma fonte clássica de scripts que
funcionam "por acaso" num SO e falham em outro. Resolver o caminho via
`require.resolve` e rodar com `spawn(process.execPath, [NEXT_BIN, ...])`
elimina essa dependência do `PATH` do shell — funciona igual em Linux,
WSL e Windows.

### Bug encontrado durante a implementação: processo "reuse" morrendo sozinho

Na primeira versão, o modo `reuse` registrava só um listener de sinal:

```js
process.on("SIGINT", () => resolve());
process.on("SIGTERM", () => resolve());
```

E o processo saía sozinho em menos de um segundo, sem nunca receber sinal
nenhum. A causa: um listener de evento **não mantém o event loop do Node
vivo por si só** — sem nenhum timer/handle pendente, o Node entende que não
há mais nada a fazer e encerra o processo assim que o script termina de
executar de forma síncrona. A correção foi manter um `setInterval` de longa
duração vivo enquanto se aguarda o sinal, e limpá-lo só quando o sinal
realmente chega:

```js
function attachAndWait(pid) {
  return new Promise((resolve) => {
    const keepAlive = setInterval(() => {}, 1 << 30);
    const onSignal = () => {
      clearInterval(keepAlive);
      resolve();
    };
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, onSignal);
    }
  });
}
```

Isso foi confirmado isoladamente com um `node -e` mínimo rodado em segundo
plano: sem o `setInterval`, o processo já não existia mais 2 segundos
depois de iniciado.

## `infra/scripts/services-guard.js` — a mesma lógica para os containers Docker

O Postgres e o Mailcatcher (`infra/compose.yaml`) têm o mesmo problema: se
`npm test` parasse os containers ao final enquanto `npm run dev` ainda
precisava deles, o servidor de dev perderia a conexão com o banco no meio do
trabalho.

A solução espelha a do lockfile de PID, mas com um marcador de posse mais
simples — um arquivo `.services-owner` (também na raiz, ignorado pelo Git)
contendo apenas o timestamp de quando os serviços foram subidos por aquela
sessão:

- **`up`**: antes de rodar `docker compose up -d`, verifica via
  `docker inspect -f {{.State.Running}} <container>` se os containers já
  estavam rodando. Só grava o marcador de posse se **ele** foi quem os
  trouxe à tona; se já estavam ativos (outra sessão os iniciou), não grava
  nada — ele é só um "convidado", não o dono.
- **`stop`** (rodado automaticamente no `posttest`): só executa
  `docker compose stop` se o marcador de posse existir. Se não existir,
  significa que outra sessão é a dona dos containers, e o `stop` é
  ignorado — os serviços continuam de pé para não interromper quem os
  estava usando.

```js
function stop() {
  if (!fs.existsSync(OWNER_LOCKFILE)) {
    console.log(
      "\n🟡 Serviços não foram iniciados por esta sessão — mantendo ativos para não afetar outra sessão em uso.\n",
    );
    return;
  }
  fs.unlinkSync(OWNER_LOCKFILE);
  execFileSync("docker", ["compose", "-f", COMPOSE_FILE, "stop"], {
    stdio: "inherit",
  });
}
```

## Resultado

Com as duas peças combinadas (`next-dev-guarded.js` + `services-guard.js`)
e os scripts do `package.json` ajustados:

```json
"dev": "npm run services:up && npm run services:wait:database && npm run migrations:up && node infra/scripts/next-dev-guarded.js",
"test": "node infra/scripts/services-guard.js up && concurrently -n next,jest --hide next -k -s command-jest \"node infra/scripts/next-dev-guarded.js --mode=reuse\" \"jest --runInBand --verbose\"",
"posttest": "node infra/scripts/services-guard.js stop"
```

- `npm run dev` sozinho: sobe tudo do zero, e se houver um fantasma na
  porta 3000, mata e assume.
- `npm test` sozinho: sobe os serviços e o Next (se não houver nada rodando)
  e para tudo ao final, pois é o dono.
- `npm run dev` já rodando, depois `npm test`: o teste reaproveita o Next e
  os containers já ativos, e ao final **não** derruba nada — o `npm run dev`
  continua rodando exatamente como estava, com o `console.log` que o
  desenvolvedor estava acompanhando intacto.
- `npm test` já rodando (ou os serviços já de pé), depois `npm run dev`: o
  dev detecta a instância existente como sua e é livre para substituí-la,
  já que ele é sempre o "modo exclusivo".

Tudo isso sem nenhum comando específico de SO — só `node:net`,
`node:child_process`, `node:fs` e o pacote `tree-kill`, o que garante que o
mesmo comportamento se repete idêntico se o projeto rodar no Windows.
