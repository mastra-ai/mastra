# Conversation simulation

Replay recorded Observational Memory generations through the production Subconscious curator dispatch path and inspect the durable knowledge it writes.

## Flow

1. **Extract** copies a bounded set of threads, messages, and Observational Memory generations from a Mastra-schema Postgres database into a local input database. The source is opened read-only.
2. **Reconstruct** rebuilds the recorded observation-cycle boundaries. It does not rerun the observer, so prompt changes cannot silently alter those boundaries.
3. **Replay** sends each completed observation delta through the same curator agent and signal dispatch used by the production Extractor. Every run uses a fresh target database.

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

## Replay

```sh
pnpm simulate:replay \
  --input "postgres://user@127.0.0.1:55432/simulate_input" \
  --target "postgres://user@127.0.0.1:55432/simulate_direct" \
  --org my-org \
  --model openai/gpt-5-mini \
  --knowledge-resource my-project-id
```

`--knowledge-resource <id>` anchors resource-scoped knowledge on a shared project identifier, matching production callers that set `knowledgeResourceId`. Use it when the replayed threads shared a project resource in production so the curator can retrieve and reconcile knowledge across source threads.

The target database is local-only, must differ from the input database, and is recreated for the run. Replay prints a `CURATOR` line for each cycle followed by one JSON object per thread. The JSON includes curator outcomes, knowledge totals, reconstruction warnings, and the number of excluded reflection heads. Missing generations, empty chunks, and unparseable dates therefore remain visible to operators.

Each reconstructed cycle is dispatched once. Curator failures are reported and are not replayed.

## Reconstruction boundaries

Generation-zero leading observation text is replayable. Leading text on later generations is a reflection head and is excluded. Duplicate generations are rejected; missing generations, empty chunks, and unparseable dates are reported as warnings. Input reconstruction currently supports thread-scoped OM records only; `--knowledge-resource` independently controls the output knowledge scope.
