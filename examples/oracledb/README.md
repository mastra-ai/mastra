# Oracle Database Example

A simplified version of the [weather agent](../../templates/weather-agent) boilerplate, wired to
`@mastra/oracledb` for storage (threads, messages, traces) and vector search.

This example is pre-release: `@mastra/oracledb` is not published to npm yet, so `package.json`
links it straight to the monorepo package (`link:../../stores/oracledb`) instead of pulling
`latest`. Swap that back to a normal version once the package is published. `@mastra/core`,
`@mastra/loggers`, `@mastra/memory`, and `mastra` are also linked to the monorepo build (via
`pnpm-workspace.yaml`'s `overrides`) so their compiled types match exactly what
`@mastra/oracledb` was built against.

## Prerequisites

- Docker (to run Oracle Database locally)
- An OpenAI API key for the agent's model

## 1. Start Oracle

```bash
cd examples/oracledb
docker compose up -d --wait
```

This uses the same `gvenzl/oracle-free:23-slim-faststart` image as `stores/oracledb`'s own
Docker Compose file. It creates the `mastra` application user from
`ORACLE_DATABASE_USER`/`ORACLE_DATABASE_PASSWORD` (see `.env` below).

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in `OPENAI_API_KEY` and, if you changed them, the `ORACLE_DATABASE_*` values. The defaults
match `docker-compose.yaml` (`localhost:1521/FREEPDB1`).

## 3. Build the linked packages

From the monorepo root, build `@mastra/oracledb` and the other packages this example links to
(`@mastra/core`, `@mastra/loggers`, `@mastra/memory`, `mastra`) so the `link:` dependencies below
resolve to real build output:

```bash
cd /path/to/mastra
pnpm turbo build --filter=@mastra/oracledb --filter=@mastra/loggers --filter=@mastra/memory --filter=mastra
```

## 4. Install

This example is a self-contained pnpm workspace (its own `pnpm-workspace.yaml`, listing only
`.`). Install it with plain `pnpm install`:

```bash
cd examples/oracledb
pnpm install
```

Do **not** pass `--ignore-workspace`: that drops the local `pnpm-workspace.yaml` `overrides` and
installs published Mastra packages from the registry instead of the linked monorepo build — which
then fails to typecheck, because `@mastra/oracledb`'s compiled types reference the exact
`MastraCompositeStore`/`MastraVector` classes from the monorepo build, not a separately published
`@mastra/core`. If that happens, delete `node_modules` and `pnpm-lock.yaml`, then run
`pnpm install` again and check the install output shows `<- ../../packages/core` style links.

## 5. Run

```bash
pnpm dev
```

Studio opens at `http://localhost:4111`. Chat with the weather agent, then check:

- **Agent chat** — ask about the weather in a city, then ask for activity suggestions to trigger
  `weatherWorkflow` (it calls the agent again internally).
- **Threads** (sidebar on the agent chat page) — persisted through `OracleStore`; query the
  Oracle tables directly (e.g. `MASTRA_THREADS`, `MASTRA_MESSAGES`) to see the same rows.
- **Observability / traces** — spans for the agent run and tool calls, also persisted in Oracle.

## Vector store and HNSW

`OracleVector` is registered on the `Mastra` instance (`vectors: { oracleVector }`) so it's
available to any agent or tool that wants similarity search, but this minimal example does not
wire semantic recall into the weather agent's `Memory`. `OracleVector` defaults to exact search,
which needs no vector index and works against the database started above.

If you want to experiment with HNSW indexes, see **"Vector memory (HNSW only)"** in
[`stores/oracledb/README.md`](../../stores/oracledb/README.md) — it explains the
`VECTOR_MEMORY_SIZE` requirement and the one-time container restart needed to enable it. This
example's `docker-compose.yaml` does not set `VECTOR_MEMORY_SIZE`; use the package's
`docker-compose.yaml` (or apply its `scripts/configure-vector-memory.sql`) if you need HNSW here.

## Cleanup

```bash
docker compose down -v
```
