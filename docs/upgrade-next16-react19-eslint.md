# Atualização: Next.js 16.2.0, React 19.2.4 e stack de ESLint flat config

Este documento registra o processo seguido para atualizar o projeto de
Next 15.0.7/React 18.3.1/ESLint 9.13.0 para as versões abaixo, replicando o
ambiente já validado pelo professor do curso:

| Pacote                   | Antes  | Depois                    |
| ------------------------ | ------ | ------------------------- |
| `next`                   | 15.0.7 | 16.2.0                    |
| `react`                  | 18.3.1 | 19.2.4                    |
| `react-dom`              | 18.3.1 | 19.2.4                    |
| `swr`                    | 2.2.5  | 2.5.0                     |
| `eslint`                 | 9.13.0 | 9.39.4                    |
| `eslint-config-next`     | 15.0.7 | 16.2.0                    |
| `eslint-config-prettier` | 9.1.0  | 10.1.8                    |
| `eslint-plugin-jest`     | 28.8.3 | 29.15.0                   |
| `@eslint/js`             | 9.17.0 | 9.39.4                    |
| `@eslint/css`            | —      | 1.0.0 (novo)              |
| `@eslint/json`           | —      | 1.1.0 (novo)              |
| `@eslint/markdown`       | —      | 7.5.1 (novo)              |
| `globals`                | —      | 17.4.0 (novo)             |
| `@eslint/eslintrc`       | 3.2.0  | removido (não usado mais) |

## Por que não foi um `npm install` direto

Havia uma tentativa anterior, feita manualmente, que misturou várias mudanças
não relacionadas num único diff: um `eslint.config.mjs` genérico (gerado por
wizard, sem as regras específicas do Next/Jest/Prettier), `eslint-config-next`
na major 16 enquanto `next` continuava na 15, e uma dependência
(`eslint-plugin-react`) referenciada no config mas nunca instalada. Isso
quebrou o lint. Por isso o processo foi refeito do zero, a partir do último
commit estável, em camadas isoladas e validadas uma a uma.

## 1. Análise de compatibilidade (antes de instalar)

Antes de tocar em qualquer arquivo, foi feito um levantamento de
`peerDependencies`/`engines` de cada pacote envolvido, via `npm view <pkg>
peerDependencies engines --json`, para garantir que a combinação de versões
não geraria conflitos:

- `next@16.2.0` exige `react`/`react-dom` em `^18.2.0` ou `^19.0.0`, e Node
  `>=20.9.0`. O projeto já roda em Node 24, então sem impacto.
- `react-dom@19.2.4` exige `react@^19.2.4` exato — por isso as duas versões
  precisam subir juntas.
- `eslint-config-next@16.2.0` exige `eslint >=9.0.0`.
- `eslint-plugin-jest@29.15.0` declara peers de `typescript`/
  `@typescript-eslint/eslint-plugin`, mas todos marcados como
  `peerDependenciesMeta.optional: true` — como o projeto é 100% JavaScript,
  isso não gera conflito nem exige instalar TypeScript.
- **Achado fora da lista original**: `swr@2.2.5` (versão então instalada)
  declara `peerDependencies.react` só até `^18.0.0` — não suporta React 19.
  A versão `swr@2.5.0` já declara suporte a `^19.0.0`. Esse bump não estava
  na lista de versões passada, mas é uma dependência obrigatória da subida
  para React 19 — sem ele o `npm install` geraria um conflito de peer
  dependency (ou, em versões antigas do npm, instalaria silenciosamente uma
  combinação inconsistente).
- Os demais pacotes do projeto (`pg`, `node-pg-migrate`, `bcrypt`,
  `bcryptjs`, `nodemailer`, `cookie`, `uuid`, `async-retry`,
  `next-connect`) não têm nenhuma dependência de `react`/`next` em seus
  `peerDependencies`, então não são afetados pela major bump.

## 2. Reset do estado experimental

```bash
git restore -- eslint.config.mjs package-lock.json package.json
```

Voltou o working tree para o último commit estável, descartando a tentativa
anterior, antes de começar a aplicar as mudanças de forma controlada.

## 3. Camada 1 — ESLint flat config

1. `eslint.config.mjs` foi substituído pela versão fornecida pelo professor
   (compartilhada e já validada como funcional), que:
   - usa `defineConfig` (API nova do pacote `eslint/config`, incluída no
     próprio `eslint` a partir da v9, sem precisar de `@eslint/eslintrc`/
     `FlatCompat`);
   - importa `nextVitals` diretamente de `eslint-config-next/core-web-vitals`
     (já no formato flat config nativo — não precisa mais do wrapper de
     compatibilidade que a versão anterior usava para configs legadas);
   - aplica `eslint-plugin-jest` só nos arquivos de teste
     (`tests/**/*.test.js`);
   - adiciona linting de JSON, Markdown e CSS via `@eslint/json`,
     `@eslint/markdown` e `@eslint/css` (não existia antes — o projeto só
     lintava JS);
   - ignora explicitamente `package-lock.json` do linting de JSON (arquivo
     gerado, não deve ser fonte de erros de lint);
   - aplica `eslint-config-prettier/flat` por último, para desativar regras
     de estilo que conflitariam com o Prettier.
2. `package.json` (`devDependencies`) foi atualizado para as versões da
   tabela acima. `@eslint/eslintrc` foi removido por não ser mais importado
   por nenhum arquivo do projeto.
3. `npm install` — instalado sem erros de peer dependency.
4. Validação: `npm run lint:eslint:check` e `npm run lint:prettier:check`
   rodaram limpos (exit code 0), confirmando que a nova config cobre o
   código existente sem introduzir falsos positivos.

## 4. Camada 2 — Next.js 16 + React 19

1. `package.json` (`dependencies`) atualizado: `next` → `16.2.0`, `react` e
   `react-dom` → `19.2.4`, `swr` → `2.5.0`.
2. `npm install` — o instalador emitiu um aviso `ERESOLVE overriding peer
dependency` durante a resolução (esperado nesse tipo de bump, por causa
   de uma versão intermediária do `react-dom` ainda referenciada no lock
   anterior), mas a resolução final ficou consistente. Confirmado via
   `npm ls react react-dom next swr`: uma única versão de `react` (19.2.4)
   deduplicada em toda a árvore — sem duas cópias de React coexistindo, o
   que é a causa mais comum de bugs sutis em upgrades de major do React.
3. Validação, na ordem:
   - `npm test` → 14 suítes / 59 testes, todos passando.
   - `npm run build` (o mesmo comando que a Vercel roda no deploy) →
     build de produção concluído com sucesso, todas as 9 rotas geradas,
     **sem nenhum warning** (o aviso de serialização do parser do ESLint
     que aparecia em versões anteriores do Next não ocorre mais nesta
     configuração).

## 5. Observação fora do escopo (não corrigida)

`npm audit` aponta vulnerabilidades em dependências **transitivas**
(`postcss` e `sharp`, empacotados internamente pelo próprio `next`; `tar`,
usado pela cadeia de instalação nativa do `bcrypt`; e uma atualização de
patch pendente do `nodemailer`). Nenhuma delas está nas versões que você
pediu para instalar, e corrigi-las exigiria pular para `next@16.3.0` ou
`bcrypt@6.0.0` (breaking change) — fora do escopo desta atualização. Fica
registrado para uma decisão futura, caso quiera tratar separadamente.
