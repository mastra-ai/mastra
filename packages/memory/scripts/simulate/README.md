# Conversation simulation

Extract recorded Observational Memory generations into a local input database and reconstruct their observation-cycle boundaries.

## Flow

1. **Extract** copies a bounded set of threads, messages, and Observational Memory generations from a Mastra-schema Postgres database into a local input database. The source is opened read-only.
2. **Reconstruct** rebuilds the recorded observation-cycle boundaries. It does not rerun the observer, so prompt changes cannot silently alter those boundaries.

Lifecycle ordering across sync, buffered, idle, and resource-scoped observation strategies is covered by the observation-strategy tests. This simulator starts at the already-completed observation boundary.

## Extract

```sh
pnpm simulate:extract \
  --source "$SIMULATE_SOURCE_URL" \
  --target "postgres://user@127.0.0.1:55432/simulate_input" \
  --threads 5
```

| Flag               | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `--source <url>`   | Required. Opened read-only; never written.                    |
| `--target <url>`   | Required. Must use a literal loopback address.                |
| `--threads <n>`    | Most-recent N threads with an OM record.                      |
| `--thread-id <id>` | Repeatable explicit IDs; mutually exclusive with `--threads`. |

The final lines report `EXTRACTED_THREADS=`, `EXTRACTED_MESSAGES=`, and `EXTRACTED_OM_RECORDS=`.

## Reconstruction boundaries

Generation-zero leading observation text is kept. Leading text on later generations is a reflection head and is excluded. Duplicate generations are rejected; missing generations, empty chunks, and unparseable dates are reported as warnings. Input reconstruction currently supports thread-scoped OM records only.
