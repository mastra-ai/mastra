# @mastra/pulse (experimental)

> DRAFT — research preview. Interfaces, table shapes, and semantics may
> change without notice.

Standalone ClickHouse writer for Mastra's experimental **pulse** model:
event-first observability where the agent appends small immutable facts
(`pulses`) and link rows (`relationships`) the moment things happen, and
everything else — flows, trees, durations, status, cost — is derived at
read time.

Pulse is fully independent of the span-based observability system: it
never ingests spans, and this package performs no translation and no
historic-trace import.

## What this package ships

- `ClickHouseHttpPulseExporter` — batching writer that ships pulse bus
  events to ClickHouse over HTTP (for apps without a composite storage
  setup).
- `ensurePulseTables` — creates the `pulses` and `relationships` tables
  (and the database) idempotently.
- Re-exports of the core pipeline pieces: `PulseBus`,
  `PulseStorageExporter`, `nextPulseSeq`.

The pulse pipeline itself (emitter, bus, lifecycle facts, derived read
model) lives in `@mastra/core` and is enabled with `new Mastra({ pulse })`.

## Usage

```ts
import { Mastra } from '@mastra/core';
import { ClickHouseHttpPulseExporter, ensurePulseTables } from '@mastra/pulse';

await ensurePulseTables({ url: 'http://localhost:8123', database: 'pulse' });

export const mastra = new Mastra({
  pulse: {
    exporters: [new ClickHouseHttpPulseExporter({ url: 'http://localhost:8123', database: 'pulse' })],
  },
});
```

See the [Pulse guide](https://mastra.ai/docs/observability/pulse) and the
[reference](https://mastra.ai/reference/observability/pulse-exporter) for
the full model, configuration, and the derived read API.
