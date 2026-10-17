# Durable agent Postgres write benchmark

`durable-bench.mjs` runs a durable or evented agent against `PostgresStore` with a mock model. It counts every query the `pg` driver sends, so you can see how many queries and bytes each agent step costs in each checkpoint mode. The numbers in [Running durable agents on Postgres in production](../../../docs/src/content/en/docs/deployment/postgres-production.mdx) come from this script.

The mock model calls a `fetchDoc` tool `steps - 1` times and then returns a text answer. Each tool call returns `toolBytes` bytes. No real LLM is called.

## Setup

Build the packages the script imports from `dist`:

```bash
pnpm turbo build --filter ./packages/core --filter ./stores/pg --filter ./packages/memory
```

Point it at a Postgres database with `DATABASE_URL`. Without a real Postgres server, you can use [PGlite](https://pglite.dev) over a socket:

```bash
mkdir -p /tmp/pgl && cd /tmp/pgl
npm install @electric-sql/pglite @electric-sql/pglite-socket
npx pglite-server -p 5434 &
```

The default `DATABASE_URL` is `postgresql://postgres:postgres@127.0.0.1:5434/postgres`, which matches the command above.

## Run

```bash
node scripts/bench/durable-postgres/durable-bench.mjs <mode> <steps> <concurrency> <toolBytes> [memory]
```

| Argument      | Values                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------- |
| `mode`        | `durable-off` (default `recovery.durableAgents: 'off'`), `durable-auto` (`'auto'`), `evented` |
| `steps`       | Agent steps per run                                                                           |
| `concurrency` | Runs started in parallel                                                                      |
| `toolBytes`   | Size of each tool result                                                                      |
| `memory`      | Pass `memory` to attach `Memory` with a thread per run                                        |

| Environment variable | Effect                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Connection string                                                                     |
| `POOL_MAX`           | `PostgresStore` pool size (default `20`)                                              |
| `RANDOM_BODY=1`      | Use random base64 tool output. Repeated characters compress unrealistically in TOAST. |
| `SAVE_PER_STEP=1`    | With `memory`, pass `savePerStep: true` so checkpoints reference saved messages.      |

Example:

```bash
RANDOM_BODY=1 node scripts/bench/durable-postgres/durable-bench.mjs durable-auto 20 1 2000
```

The script prints one JSON line. The main fields are:

- `queriesPerRunStep` and `bytesPerRunStep`: queries and bytes (SQL text plus parameters) sent per agent step
- `snapshotWrites` and `snapshotWriteBytes`: inserts/updates against `mastra_workflow_snapshot`
- `peakSnapshotRowBytes`: largest stored snapshot row seen while runs were in flight
- `breakdown`: query count and bytes per statement type and table

## Limits

PGlite is a single-connection, in-memory Postgres. Query counts and bytes sent are reliable, because they are measured at the driver. Timing, WAL volume, IOPS, autovacuum and lock behavior are not representative. Concurrent runs against PGlite need `POOL_MAX=1`, because `pglite-socket` fails with `portal "" does not exist` when several connections interleave. Run against a real Postgres server to measure throughput, CPU and IOPS.
