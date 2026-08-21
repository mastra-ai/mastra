# Conversation simulation

Replay real conversation threads through the Subconscious capture and curation pipeline
locally, so a capture or curation prompt change can be A/B'd in minutes against real data
instead of deploying and waiting a day for organic usage.

## Flow

1. **Extract** — copy a bounded set of threads (thread rows, messages, and _all_
   Observational Memory record generations) out of any Mastra-schema Postgres into a local
   Postgres "input" database.
2. **Replay** — reconstruct each thread's original observation cycles from those records
   and drive them through capture + curation against a local store.

```sh
pnpm simulate:extract -- \
  --source "$SIMULATE_SOURCE_URL" \
  --target "postgres://user@127.0.0.1:55432/simulate_input" \
  --threads 5
```

Flags:

| Flag               | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `--source <url>`   | Required. Opened read-only; never written.                     |
| `--target <url>`   | Required. Must be a localhost Postgres.                        |
| `--threads <n>`    | Most-recent N threads that carry at least one OM record.       |
| `--thread-id <id>` | Repeatable. Explicit ids. Mutually exclusive with `--threads`. |

The final lines are machine-greppable: `EXTRACTED_THREADS=`, `EXTRACTED_MESSAGES=`,
`EXTRACTED_OM_RECORDS=`.

## Database topology

| Role                          | Lifecycle                                  |
| ----------------------------- | ------------------------------------------ |
| Source (any Mastra Postgres)  | Read-only, never written, never dropped    |
| Input DB (`simulate_input`)   | Written once by extraction, then immutable |
| Arm DBs (`simulate_arm_a`, …) | Dropped and recreated per arm, per run     |

## Safety

- The source session is set to `TRANSACTION READ ONLY` before any query runs, so a write
  attempt fails loudly rather than succeeding quietly.
- The target host must be `127.0.0.1`, `localhost`, or `[::1]`. Anything else exits
  non-zero. A hostname that merely _contains_ "localhost" is rejected.
- **Write-back to the source is out of scope.** This tooling never writes to a remote
  database.

## Prerequisites

- Access to any Postgres carrying the Mastra memory schema (tables `mastra_threads`,
  `mastra_messages`, `mastra_observational_memory`) — a production deployment, a staging
  environment, or a local dev database all work. Nothing about the tool is specific to one
  deployment: source and target are passed as flags, and the copied columns are read from
  `information_schema` rather than hardcoded.
- A local Postgres to extract into.
