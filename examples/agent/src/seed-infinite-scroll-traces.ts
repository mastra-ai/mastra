/**
 * Seeds completed traces straight into the observability DuckDB file so the traces explorer has
 * enough rows to exercise infinite scroll. No model calls: each trace is a single root span.
 *
 * The index is in the trace name and input preview (`#001` is the oldest, the highest is the
 * newest), one minute apart and ending now, so the list order is easy to check while scrolling.
 *
 * DuckDB allows one writer: stop `mastra dev` first.
 *
 * Usage: npx tsx src/seed-infinite-scroll-traces.ts [count]   (default: 200)
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DuckDBStore } from '@mastra/duckdb';

// `mastra dev` runs from `src/mastra/public`, where `./mastra-observability.duckdb` resolves.
const DB_PATH = fileURLToPath(new URL('./mastra/public/mastra-observability.duckdb', import.meta.url));
const SPACING_MS = 60_000;

const count = Number.parseInt(process.argv[2] ?? '200', 10);
const width = String(count).length;
const now = Date.now();

const records = Array.from({ length: count }, (_, i) => {
  const index = String(i + 1).padStart(width, '0');
  const startedAt = new Date(now - (count - 1 - i) * SPACING_MS);
  return {
    traceId: randomUUID().replaceAll('-', ''),
    spanId: randomUUID().replaceAll('-', '').slice(0, 16),
    parentSpanId: null,
    name: `seed trace #${index}`,
    spanType: 'agent_run' as const,
    isEvent: false,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 500 + (i % 7) * 300),
    entityType: 'agent' as const,
    entityId: 'seed-agent',
    entityName: 'Seed agent',
    input: { messages: [{ role: 'user', content: `Seed trace #${index} of ${count}` }] },
    inputPreview: `Seed trace #${index} of ${count}`,
    output: { text: `Answer #${index}` },
    outputPreview: `Answer #${index}`,
  };
});

const store = new DuckDBStore({ path: DB_PATH });
await store.observability.init();
await store.observability.batchCreateSpans({ records });
await store.close();

console.log(`Seeded ${count} traces into ${DB_PATH}`);
