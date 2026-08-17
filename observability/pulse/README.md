# @mastra/pulse (experimental)

Adapters for Mastra's event-first ("Pulse") observability pipeline — a
research preview.

Instead of storing spans with durations and parent pointers, Pulse writes
**append-only instant facts** (`pulses`) and **link rows** (`relationships`),
and derives everything smart — flows, trees, durations, status — at read time.
Because facts land as they happen, in-flight runs are visible (e.g. "tool
approval pending" mid-run), which span-based views structurally cannot show
until a run ends.

**The pipeline itself lives in `@mastra/core`.** Configuring `pulse` on Mastra
constructs a dedicated `PulseBus`, a span bridge over the observability
pipeline (all 30 `SpanType`s, logs, scores, feedback; token/cost metrics are
folded into the semantic model pulses' `data` — actions stay verbs), native
AgentController session forwarding (approvals, TRUE abort outcome, follow-ups,
mode/model switches), and a batching writer into the `pulse` storage domain.

This package carries what does NOT belong in core:

- `ClickHouseHttpPulseExporter` — a standalone ClickHouse writer for users
  without a composite store carrying a pulse domain
- `ensurePulseTables` — the ClickHouse DDL helper
- `backfillFromObservability` — replay persisted traces into the pulse model

## Configure (core-native)

```ts
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ...agents, workflows...
  // Default writer: the composite store's `pulse` domain
  // (e.g. PulseStorageClickhouse from @mastra/clickhouse).
  pulse: {},
});
```

Without `pulse` configured, nothing is constructed — stock behavior.

### Standalone ClickHouse writer (no composite store)

```ts
import { ClickHouseHttpPulseExporter } from '@mastra/pulse';

export const mastra = new Mastra({
  pulse: {
    exporters: [
      new ClickHouseHttpPulseExporter({
        url: 'http://localhost:8123',
        database: 'pulse',
        username: 'default',
        password: '',
      }),
    ],
  },
});
```

## Tables

Create once (helper included):

```ts
import { ensurePulseTables } from '@mastra/pulse';
await ensurePulseTables({ url: 'http://localhost:8123', database: 'pulse' });
```

`pulses`: `id, timestamp, seq, type(input|output|decision|state|error|progress|
system), surface, action, level, text, data(numeric-map JSON), attributes,
metadata(string-map JSON)` + correlation columns (`trace_id, span_id,
parent_span_id, run_id, thread_id, resource_id, source`).

`relationships`: `id, timestamp, seq, type, from_kind/from_id, to_kind/to_id,
attributes, trace_id` with endpoint kinds
`pulse|flow|thread|model_input|content|definition|external`.

## Derived read model (nothing below is stored)

- flow = `GROUP BY trace_id`; tree = self-join on `parent_of` edges
- duration = paired `*_started` / `*_completed` timestamp subtraction
- status = `completed | failed | aborted | stale | running` (the session-layer
  abort fact overrides the span outcome; no terminal pulse + quiet ⇒ stale)
- resume = `resume_of` edges stitch suspended/resumed segments
- token/cost = the semantic model pulse's `data`
  (`total_input_tokens, total_output_tokens, …, cost_usd`), folded from metric
  events inside the core bridge

## Backfill

```ts
import { backfillFromObservability } from '@mastra/pulse';

// Through a pulse storage domain (internal bus + writer managed for you):
await backfillFromObservability({ observability: observabilityStore, storage: pulseStore });

// Or onto an existing PulseBus you own:
await backfillFromObservability({ observability: observabilityStore, bus: mastra.pulseBus! });
```

## Session facts

Session facts (approvals, the true abort with its run id, follow-ups,
mode/model switches) are forwarded natively by the AgentController whenever
`pulse` is configured on Mastra — no per-session wiring.

## Limitations (research preview)

- Payloads capped in the core bridge (default 4KB, `payloadCapBytes`); full
  message arrays are never exported.
- `SPAN_UPDATED` events are counted but not translated (dedupe semantics open).
- Content identity (`included_in_model_input`) and file-hash definition
  identity require deeper emit sites and are not produced yet.
- Buffers are in-memory: a hard crash loses the unflushed tail (by design the
  read model surfaces such flows as `stale`).
- The HTTP writer uses the ClickHouse HTTP interface via global fetch (no
  client dependency); swap to `@clickhouse/client` when productionizing.
