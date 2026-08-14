# @mastra/pulse (experimental)

Event-first ("Pulse") observability exporter for Mastra — a research preview.

Instead of storing spans with durations and parent pointers, Pulse writes
**append-only instant facts** (`pulses`) and **link rows** (`relationships`) to
ClickHouse, and derives everything smart — flows, trees, durations, status —
at read time. Because facts land as they happen, in-flight runs are visible
(e.g. "tool approval pending" mid-run), which span-based views structurally
cannot show until a run ends.

The exporter consumes every ObservabilityBus event family: spans (all 30
`SpanType`s), logs, metrics (including **cost**, which only exists on metric
events), scores, feedback, and drop meta-events.

## Install & configure

```ts
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { PulseExporter } from '@mastra/pulse';

export const mastra = new Mastra({
  // ...agents, workflows...
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new PulseExporter({
            url: 'http://localhost:8123',
            database: 'pulse',
            username: 'default',
            password: '',
          }),
        ],
      },
    },
  }),
});
```

Without `url` + `database` the exporter disables itself and writes nothing.

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
- cost per flow = SUM over metric pulses' `data.estimated_cost_usd`

## Session facts

Spans miss session-layer facts (approvals, TRUE abort, follow-ups). Attach the
listener to an Agent Controller session:

```ts
import { attachPulseSession } from '@mastra/pulse';
attachPulseSession(session, pulseExporter, { threadId, resourceId });
```

## Limitations (research preview)

- Payloads capped (default 4KB, `payloadCapBytes`); full message arrays are
  never exported.
- `SPAN_UPDATED` events are counted but not translated (dedupe semantics open).
- Content identity (`included_in_model_input`) and file-hash definition
  identity require deeper emit sites and are not produced by this exporter.
- Buffers are in-memory: a hard crash loses the unflushed tail (by design the
  read model surfaces such flows as `stale`).
- Uses the ClickHouse HTTP interface via global fetch (no client dependency);
  swap to `@clickhouse/client` when productionizing.
