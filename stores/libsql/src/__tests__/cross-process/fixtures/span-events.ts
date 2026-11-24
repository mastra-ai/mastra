/**
 * Span lifecycle truth for the cross-process span tests: every process appends one JSON line per
 * SPAN_STARTED / SPAN_ENDED to a file in the shared test directory. The stored trace cannot prove
 * "ended exactly once" (a store keeps one row per span), so the tests read these lines.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter, MastraStorageExporter, Observability } from '@mastra/observability';

export interface SpanEvent {
  role: string;
  ev: 'span_started' | 'span_ended';
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  type: string;
  outcome: string | null;
  resumed: boolean;
  recovered: boolean;
  runId: string | null;
}

class SpanEventsExporter extends BaseExporter {
  name = 'span-events';
  constructor(
    private readonly file: string,
    private readonly role: string,
  ) {
    super({});
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type !== 'span_started' && event.type !== 'span_ended') return;
    const span = event.exportedSpan;
    const metadata = (span.metadata ?? {}) as Record<string, unknown>;
    const row: SpanEvent = {
      role: this.role,
      ev: event.type,
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      type: span.type,
      outcome: span.outcome ?? null,
      resumed: metadata.resumed === true,
      recovered: metadata.recovered === true,
      runId: typeof metadata.runId === 'string' ? metadata.runId : null,
    };
    appendFileSync(this.file, `${JSON.stringify(row)}\n`);
  }
}

/** Ended spans are inserted whole, so a worker's end never has to find a row another process wrote. */
export function createSpanEventsObservability(eventsPath: string, role: string) {
  return new Observability({
    configs: {
      default: {
        serviceName: 'xproc-span-events',
        exporters: [
          new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 }),
          new SpanEventsExporter(eventsPath, role),
        ],
      },
    },
  });
}

export interface SpanLifecycle {
  spanId: string;
  type: string;
  parentSpanId: string | null;
  startedBy: string[];
  endedBy: Array<{ role: string; outcome: string | null }>;
  resumed: boolean;
  recovered: boolean;
}

/** Every span of the run's trace, in start order, with who started and who ended it. */
export function readSpanLifecycles(eventsPath: string, runId: string): SpanLifecycle[] {
  const events: SpanEvent[] = existsSync(eventsPath)
    ? readFileSync(eventsPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as SpanEvent)
    : [];
  const traceIds = new Set(events.filter(event => event.runId === runId).map(event => event.traceId));
  const spans = new Map<string, SpanLifecycle>();
  for (const event of events) {
    if (!traceIds.has(event.traceId)) continue;
    const span = spans.get(event.spanId) ?? {
      spanId: event.spanId,
      type: event.type,
      parentSpanId: event.parentSpanId,
      startedBy: [],
      endedBy: [],
      resumed: event.resumed,
      recovered: event.recovered,
    };
    if (event.ev === 'span_started') span.startedBy.push(event.role);
    else span.endedBy.push({ role: event.role, outcome: event.outcome });
    spans.set(event.spanId, span);
  }
  return [...spans.values()];
}

export function describeSpans(spans: SpanLifecycle[]): string {
  return spans
    .map(
      span =>
        `${span.type} ${span.spanId.slice(0, 8)} parent=${span.parentSpanId?.slice(0, 8) ?? '-'} ` +
        `started=${span.startedBy.join(',')} ended=${span.endedBy.map(end => `${end.role}:${end.outcome}`).join(',')}` +
        `${span.resumed ? ' resumed' : ''}${span.recovered ? ' recovered' : ''}`,
    )
    .join('\n');
}
