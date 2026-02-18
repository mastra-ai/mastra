CONTRIBUTING_CI.md
==================

Este documento descreve, em passos claros, como executar o projeto localmente e como funciona o pipeline de CI (GitHub Actions) usado neste repositório.

Sumário
-------
- **Pré-requisitos**
- **Instalação e setup local**
- **Comandos úteis (build / test / lint / typecheck / e2e)**
- **Visão geral do pipeline (workflows principais)**
- **Como disparar workflows manualmente**
- **Secrets e variáveis necessárias**
- **Dicas para contribuições e troubleshooting**

1. Pré-requisitos
------------------

- Node.js (recomendado: 22.x ou 24.x para algumas ações de release)
- pnpm >= 10.18.0 (o projeto exige pnpm; `package.json` declara `pnpm@10.27.0`)
- Git
- Docker (opcional, só se precisa ligar `dev:services:up`)

Instale o `pnpm` globalmente se ainda não tiver:

```bash
npm install -g pnpm
```

2. Instalação e setup local
---------------------------

Clone o repositório e instale dependências:

```bash
git clone https://github.com/mastra-ai/mastra.git
cd mastra
pnpm install
```

Setup inicial (compila pacotes internos):

```bash
pnpm run setup
```

Observações:
- O monorepo usa `turbo` para builds distribuídos e `pnpm` workspaces.
- Para rodar serviços de apoio (se necessário):

```bash
pnpm run dev:services:up
# para derrubar
pnpm run dev:services:down
```

3. Comandos úteis
-----------------

- Instalar dependências: `pnpm install`
- Build (monorepo): `pnpm build` (usa `pnpm turbo build`)
- Testar (unit): `pnpm test` (usa Vitest)
- Testar em watch: `pnpm test:watch`
- Lint: `pnpm lint`
- Prettier (formatar): `pnpm prettier:format`
- Typecheck: `pnpm typecheck`
- Executar playground local: `pnpm run dev:playground`
- Limpeza: `pnpm run cleanup`

E2E (local): cada suíte E2E tem pasta em `e2e-tests/` e geralmente usa `pnpm install --ignore-workspace` dentro da pasta, depois `pnpm test`.

Exemplo (rodar suite monorepo e2e localmente):

```bash
cd e2e-tests/monorepo
pnpm install --ignore-workspace
pnpm test
```

4. Visão geral do pipeline (workflows principais)
-----------------------------------------------

Os workflows principais estão em `.github/workflows/`.

- **Quality assurance** — [`.github/workflows/lint.yml`](.github/workflows/lint.yml#L1)
  - Trigger: `pull_request` (branches `main`, `0.x`) e filtra arquivos irrelevantes (examples/docs).
  - Jobs principais: `lint`, `prebuild` (build + typecheck), `check-bundle`, `validator`, `peerdeps-check`, `validate-pkg-json`.
  - Objetivo: garantir lint, formatação, compilação e validações antes de aceitar PRs.

- **E2E Tests** — [`.github/workflows/secrets.e2e.yml`](.github/workflows/secrets.e2e.yml#L1)
  - Trigger: é disparado por `workflow_run` quando o fluxo de `Quality assurance` completa.
  - Primeiro passo: detecta se mudanças exigem E2E (usa `dorny/paths-filter`) e pula se não houver alterações relevantes.
  - Várias suites E2E (monorepo, no-bundling, create-mastra, commonjs, deployers, type-check, kitchen-sink, client-js, etc.).
  - Usa secrets como `OPENAI_API_KEY`, `TURBO_TOKEN`, `TURBO_TEAM`.

- **Publish / Release** — [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml#L1) e [`.github/workflows/create-release.yml`](.github/workflows/create-release.yml#L1)
  - `npm-publish.yml` suporta `workflow_dispatch` (inputs: `publish_type` = prerelease|stable|snapshot) e push na `main` para publicar prereleases.
  - `create-release.yml` é usado para criar releases estáveis via `workflow_dispatch` (usa `changesets`, faz build, publica pacotes e adiciona tags).
  - Ambos os fluxos executam: checkout, setup pnpm/node, `pnpm install`, `pnpm build`, e então `pnpm publish -r` (variando flags conforme tipo de publicação).

- **Outros workflows úteis**
  - `lint.yml` cobre a maioria das checagens de qualidade.
  - Existe `contributor_actions.yml` que contém ações específicas para colaboradores (veja `.github/workflows/contributor_actions.yml`).

5. Como o fluxo acontece na prática (ordem típica ao abrir um PR)
----------------------------------------------------------------

1. PR é aberto/sincronizado -> `Quality assurance` é disparado:
   - Lint, formatação, build, typecheck e validações executam.
2. Ao término do `Quality assurance`, o `E2E Tests` (se aplicável) é disparado via `workflow_run`.
3. Se tudo passar e houver changesets/version bump, os fluxos de publish podem ser executados (dependendo de automação ou acionamento manual).

6. Como acionar workflows manualmente
------------------------------------

- Para publicar manualmente (prerelease/stable/snapshot): vá em Actions → selecione `Publish to npm` (`npm-publish.yml`) → `Run workflow` → escolha `publish_type` e execute.
- Para criar release estável: selecione `Create Stable Release` (`create-release.yml`) → `Run workflow`.

7. Secrets e variáveis que o CI usa
----------------------------------

Os principais secrets/vars usados pelos workflows incluem (configurados no repositório GitHub):

- `TURBO_TOKEN`, `TURBO_TEAM` — cache remoto / turbo remote
- `NPM_TOKEN` — publish para npm (usado em `create-release.yml` e `npm-publish.yml`)
- `OPENAI_API_KEY` — usado em E2E tests que chamam APIs externas
- `DANE_APP_PRIVATE_KEY`, `DANE_APP_ID` — usados nas ações de release que usam autenticação de app (Dane App Auth)
- `GITHUB_TOKEN` — token padrão para ações que precisam operar no repositório

8. Debug / execução local do CI (dicas)
--------------------------------------

- Para simular jobs do GitHub Actions localmente, você pode usar `nektos/act` (ferramenta de terceiros), porém ações personalizadas locais (`./.github/actions/...`) podem exigir ajustes para rodar no `act`.
- Para validar partes do pipeline rapidamente localmente, rode os mesmos comandos que as actions executam, por exemplo:

```bash
pnpm install
pnpm lint
pnpm build
pnpm test
```

- Ao investigar falhas em CI, baixe os logs completos do job no Actions e reproduza localmente o comando que falhou.

9. Boas práticas para contribuições (CI-friendly)
-------------------------------------------------

- Faça commits pequenos e focados; evite incluir mudanças irrelevantes em `examples/` ou `docs/` junto com mudanças de código.
- Rode `pnpm lint`, `pnpm test` e `pnpm build` localmente antes de abrir PR.
- Use `pnpm run prettier:format` para formatar mudanças.
- Se precisar de um publish de teste, use `npm-publish.yml` com `publish_type: snapshot` em branches não-main.

10. Referências (arquivos de workflow)
------------------------------------

- Quality assurance: [.github/workflows/lint.yml](.github/workflows/lint.yml#L1)
- E2E tests: [.github/workflows/secrets.e2e.yml](.github/workflows/secrets.e2e.yml#L1)
- Publish: [.github/workflows/npm-publish.yml](.github/workflows/npm-publish.yml#L1)
- Create release: [.github/workflows/create-release.yml](.github/workflows/create-release.yml#L1)
- Lista completa de workflows: veja o diretório `.github/workflows/` no repositório.

11. Se precisar de ajuda
-----------------------

Abra uma issue descrevendo o problema com passos para reproduzir, anexando logs do CI e indicando o job/fail específico. Para falhas de publish, verifique se os `secrets` necessários estão presentes e atualizados.

---

12. Debugando a partir dos logs do GitHub Actions
-------------------------------------------------

Passos rápidos para localizar e diagnosticar falhas no Actions:

- Abra a run: vá em Actions → selecione o workflow → escolha a execução que falhou.
- Visualize o job com falha: clique no job e expanda os passos para ver o log detalhado de cada step.
- Baixe os logs completos: na página da run clique no menu (três pontos) e escolha "Download logs" para obter o .zip com logs por job.
- Verifique artifacts: a execução pode publicar artifacts (aba "Artifacts") — baixe-os para inspecionar arquivos de build/test.
- Re-execute a run: use "Re-run jobs" → "Re-run failed jobs" (ou "Re-run all jobs") para tentar novamente.

Como obter logs mais detalhados (debug):

- Habilite logs de step e do runner criando secrets no repositório:
  - `ACTIONS_STEP_DEBUG=true` — ativa mensagens de debug das ações.
  - `ACTIONS_RUNNER_DEBUG=true` — ativa logs de diagnóstico do runner.
  Após adicionar os secrets, re-execute a run para coletar logs com mais detalhes.

Como reproduzir localmente o erro (passo a passo):

1. Faça checkout do commit/sha da execução que falhou:

```bash
git fetch origin
git checkout <COMMIT_SHA>
```

2. Instale dependências e reproduza o comando que falhou (ver log do step para o comando exato):

```bash
pnpm install
# exemplo: se o step falhou em build
pnpm build
```

3. Se o job depende de secrets (ex.: `OPENAI_API_KEY`, `TURBO_TOKEN`), exporte valores temporários no seu shell antes de reproduzir:

```bash
export OPENAI_API_KEY=xxxx
export TURBO_TOKEN=xxxx
```

4. Para simular o ambiente Actions, use `act` (observação: ações customizadas locais podem não funcionar sem ajustes):

```bash
# instalar e rodar um job simples localmente
act -j <job_id> --container-architecture linux/amd64
```

O que checar nos logs:

- Erros de instalação: mensagens sobre `pnpm install` ou incompatibilidades de versões (Node/pnpm). Confirme versão do Node usada no job.
- Erros de build: procure stacktraces, arquivos com erros de tipo ou imports faltando; rode o mesmo `pnpm build` localmente para reproduzir.
- Falhas em testes: verifique saída dos testes, timeout ou dependências externas (API keys).
- Exit codes: cada step mostra código de saída; não-zero indica falha — localize o step e o comando exato.
