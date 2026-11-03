/**
 * Span lifecycle truth for the resume-segment tests: every process appends one JSON line per
 * SPAN_STARTED / SPAN_ENDED to a file in the shared test directory. The stored trace cannot
 * prove "ended exactly once" (a store keeps one row per span), so the test reads these lines.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter, MastraStorageExporter, Observability } from '@mastra/observability';

export interface SegmentEvent {
  pid: number;
  role: string;
  ev: 'span_started' | 'span_ended';
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  type: string;
  outcome: string | null;
  resumed: boolean;
  recovered: boolean;
  resumedFromSpanId: string | null;
  recoveredFromSpanId: string | null;
  runId: string | null;
  error: string | null;
}

class SegmentEventsExporter extends BaseExporter {
  name = 'segment-events';
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
    const row: SegmentEvent = {
      pid: process.pid,
      role: this.role,
      ev: event.type,
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      type: span.type,
      outcome: span.outcome ?? null,
      resumed: metadata.resumed === true,
      recovered: metadata.recovered === true,
      resumedFromSpanId: span.resumedFromSpanId ?? null,
      recoveredFromSpanId: typeof metadata.recoveredFromSpanId === 'string' ? metadata.recoveredFromSpanId : null,
      runId: typeof metadata.runId === 'string' ? metadata.runId : null,
      error: span.errorInfo?.message ?? null,
    };
    appendFileSync(this.file, `${JSON.stringify(row)}\n`);
  }
}

/** Ended spans are inserted whole, so a worker's end never has to find a row another process wrote. */
export function createSegmentObservability(eventsPath: string, role: string) {
  return new Observability({
    configs: {
      default: {
        serviceName: 'xproc-resume-segments',
        exporters: [
          new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 }),
          new SegmentEventsExporter(eventsPath, role),
        ],
      },
    },
  });
}

export function readSegmentEvents(eventsPath: string): SegmentEvent[] {
  if (!existsSync(eventsPath)) return [];
  return readFileSync(eventsPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SegmentEvent);
}

export interface SpanLifecycle {
  spanId: string;
  type: string;
  parentSpanId: string | null;
  startedBy: string[];
  endedBy: Array<{ role: string; outcome: string | null; error: string | null }>;
  resumed: boolean;
  recovered: boolean;
  resumedFromSpanId: string | null;
  recoveredFromSpanId: string | null;
}

/** Every span of the run's traces, in start order, with who started and who ended it. */
export function spanLifecycles(events: SegmentEvent[], runId: string): SpanLifecycle[] {
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
      resumedFromSpanId: event.resumedFromSpanId,
      recoveredFromSpanId: event.recoveredFromSpanId,
    };
    if (event.ev === 'span_started') span.startedBy.push(event.role);
    else span.endedBy.push({ role: event.role, outcome: event.outcome, error: event.error });
    spans.set(event.spanId, span);
  }
  return [...spans.values()];
}
