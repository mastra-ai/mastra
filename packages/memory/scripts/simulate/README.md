# Conversation simulation

Replay real conversation threads through the Subconscious capture and curation pipeline
locally, so a capture or curation prompt change can be A/B'd in minutes against real data
instead of deploying and waiting a day for organic usage.

## Flow

1. **Extract** — copy a bounded set of threads (thread rows, messages, and _all_
   Observational Memory record generations) out of any Mastra-schema Postgres into a local
   Postgres "input" database. Replay reads only the OM records; the thread and message rows
   are kept purely as debugging context for inspecting the source conversation — the
   simulator never replays source messages.
2. **Replay** — reconstruct each thread's original observation cycles from those records
   and drive them through capture + curation against a local store.
3. **A/B** — run two prompt configurations over the same cycles, each against its own fresh
   database, and print the difference in the knowledge produced.

```sh
pnpm simulate:extract \
  --source "$SIMULATE_SOURCE_URL" \
  --target "postgres://user@127.0.0.1:55432/simulate_input" \
  --threads 5
```

Flags:

| Flag               | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `--source <url>`   | Required. Opened read-only; never written.                     |
| `--target <url>`   | Required. Must use a literal IPv4 or IPv6 loopback address.    |
| `--threads <n>`    | Most-recent N threads that carry at least one OM record.       |
| `--thread-id <id>` | Repeatable. Explicit ids. Mutually exclusive with `--threads`. |

The final lines are machine-greppable: `EXTRACTED_THREADS=`, `EXTRACTED_MESSAGES=`,
`EXTRACTED_OM_RECORDS=`.

```sh
pnpm simulate:replay \
  --input  "postgres://user@127.0.0.1:55432/simulate_input" \
  --target "postgres://user@127.0.0.1:55432/simulate_arm_a" \
  --org my-org --capture-model google/gemini-2.5-flash --curate-model deepseek/deepseek-chat \
  --knowledge-resource my-project-id

pnpm simulate:ab \
  --input "postgres://user@127.0.0.1:55432/simulate_input" \
  --target-prefix "postgres://user@127.0.0.1:55432/simulate_run" \
  --arm-a ./arm-a.txt --arm-b ./arm-b.txt
```

`--knowledge-resource <id>` anchors the knowledge scope's resource rung on one shared id,
mirroring how production Factory sets `knowledgeResourceId` to the project id. Without it,
each thread's knowledge lands in its own per-thread resource silo, so the curator can never
see — let alone merge — duplicate entities captured across threads. Pass the source
deployment's project resource id whenever the replayed threads shared one in production.

`--arm-a` / `--arm-b` point at text files holding the instructions appended to the built-in
**capture** prompt (`--arm-a-curate` / `--arm-b-curate` do the same for the curator). The
runner refuses to start when the two arms differ in anything else — models, cadence, scopes,
thread selection. Output differences therefore reflect the prompt change plus ordinary model variance,
which the control arm helps estimate.

### Raw capture without curation

By default the replay driver curates on its own schedule (`--cadence N`, after every Nth
cycle, plus a flush at the end so no arm's tail is left uncurated). Pass `--cadence off` and
no curation happens at all — the replay drives the capture extractor and the driver's own
`runCuration` calls directly, never the `ObservationalMemory` lifecycle, so the driver's
calls are the only curation path and turning them off guarantees zero curations.

```sh
pnpm simulate:replay \
  --input  "postgres://user@127.0.0.1:55432/simulate_input" \
  --target "postgres://user@127.0.0.1:55432/simulate_arm_a" \
  --org my-org --cadence off
```

Use it to A/B **capture prompts in isolation**: the resulting knowledge is raw capture
output with no curation pass layered on top. It cannot observe lifecycle-triggered
curation — measuring when the library decides to curate would require a replay path that
actually drives the OM lifecycle (observation turns, activation, reflection), which this
simulator deliberately does not do.

A third **control** arm re-runs arm A's own configuration. Capture and curation are live
model calls, so identical prompts still diff; `CONTROL_CHANGED_RECORDS` is that noise floor.
An A-vs-B diff at or below it means the prompt change had no detectable effect. Pass
`--control false` to skip it (faster, but the A/B number is then unreadable).

The printed diff lists every diverging node by name — including nodes present in only one
arm — with the normalized record text that was added, removed, or changed under it, so a
run answers _what_ diverged, not just how much. Records under one-arm-unique nodes count
in the added/removed totals. Pass `--report <path>` to also write the full structured diff
(per-node entries, control diff, curation outcomes, config hashes) as JSON.

The summary block is machine-greppable: `ARM_A_NODES=`, `ARM_B_NODES=`, `ONLY_IN_A=`,
`ONLY_IN_B=`, `CHANGED_RECORDS=`, `CONTROL_CHANGED_RECORDS=`, `SOURCE_THREADS=`,
`CYCLES_REPLAYED=`, `ARM_A_CONFIG_HASH=`, `ARM_B_CONFIG_HASH=`, `MODEL=`, `REPORT=`.

## What this exercises — and what it does not

Cycle boundaries are **pinned**: they are reconstructed from what production actually
recorded, not re-derived by running the observer. The observer's dynamic threshold shifts as
observation text grows, so re-observing would let a prompt change silently move the cycle
boundaries too, confounding every result. The cost of that choice is that the observer and
reflector are **not** exercised here — only capture and curation are.

The arms vary the **appended** instructions on the built-in capture/curate prompts; they do
not replace the built-in contract, which the pipeline depends on.

## Database topology

| Role                          | Lifecycle                                  |
| ----------------------------- | ------------------------------------------ |
| Source (any Mastra Postgres)  | Read-only, never written, never dropped    |
| Input DB (`simulate_input`)   | Written once by extraction, then immutable |
| Arm DBs (`simulate_arm_a`, …) | Dropped and recreated per arm, per run     |

## Safety

- The source session is set to `TRANSACTION READ ONLY` before any query runs, so a write
  attempt fails loudly rather than succeeding quietly.
- The target host must be the literal loopback address `127.0.0.1` or `[::1]`. Hostnames,
  including `localhost`, are rejected so DNS cannot redirect writes elsewhere.
- Extraction refuses to continue when source and target resolve to the same database.
- **Write-back to the source is out of scope.** This tooling never writes to a remote
  database.

## Prerequisites

- Access to any Postgres carrying the Mastra memory schema (tables `mastra_threads`,
  `mastra_messages`, `mastra_observational_memory`) — a production deployment, a staging
  environment, or a local dev database all work. Nothing about the tool is specific to one
  deployment: source and target are passed as flags, and the copied columns are read from
  `information_schema` rather than hardcoded.
- A local Postgres **13 or newer** to extract into, with `pgvector` available: Subconscious
  knowledge is semantic, so each arm needs a vector store alongside its database, and the
  per-arm database reset uses `DROP DATABASE ... WITH (FORCE)`, which Postgres 13 introduced.
- Built workspace libraries (`pnpm build:memory` from the repository root). Replay loads the
  PostgreSQL adapter from its generated `dist` output.
- Model credentials for whichever providers `--capture-model`, `--curate-model`, and
  `--embedder` resolve to (e.g. `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`).
  Capture and curation may run on different models; both arms always use the same pair.

## Known provider gotchas

- Google models drive capture fine but currently fail the curator with
  `parameters.any_of[n].required: only allowed for OBJECT type` when the knowledge tools are
  converted to function declarations.
- The curator is fail-closed: a reply that does not end in `<curation-complete through="…" />`
  produces a `failed` curation, reported loudly and counted, rather than a silent no-op.
  Weaker models fail this often; that is a measurement, not a tool bug.
