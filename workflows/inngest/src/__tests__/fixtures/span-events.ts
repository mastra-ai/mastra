/**
 * Span lifecycle truth for the cross-process resume tests: every process appends one JSON line per
 * SPAN_STARTED / SPAN_ENDED to a file in the shared output directory. The stored trace cannot prove
 * "ended exactly once" (a store keeps one row per span), so the test reads these lines.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';

export interface SpanEvent {
  pid: number;
  role: string;
  ev: 'span_started' | 'span_ended';
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  type: string;
  outcome: string | null;
  resumed: boolean;
  resumedFromSpanId: string | null;
  runId: string | null;
  error: string | null;
}

export class SpanEventsExporter extends BaseExporter {
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
      pid: process.pid,
      role: this.role,
      ev: event.type,
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      type: span.type,
      outcome: span.outcome ?? null,
      resumed: metadata.resumed === true,
      resumedFromSpanId: span.resumedFromSpanId ?? null,
      runId: typeof metadata.runId === 'string' ? metadata.runId : null,
      error: span.errorInfo?.message ?? null,
    };
    appendFileSync(this.file, `${JSON.stringify(row)}\n`);
  }
}

export function readSpanEvents(file: string): SpanEvent[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SpanEvent);
}

export interface SpanLifecycle {
  spanId: string;
  type: string;
  parentSpanId: string | null;
  startedBy: string[];
  endedBy: Array<{ role: string; outcome: string | null; error: string | null }>;
  resumed: boolean;
  resumedFromSpanId: string | null;
}

/** Every span of the run's traces, in start order, with who started and who ended it. */
export function spanLifecycles(events: SpanEvent[], runId: string): SpanLifecycle[] {
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
      resumedFromSpanId: event.resumedFromSpanId,
    };
    if (event.ev === 'span_started') span.startedBy.push(event.role);
    else span.endedBy.push({ role: event.role, outcome: event.outcome, error: event.error });
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
        (span.resumed ? ' resumed' : ''),
    )
    .join('\n');
}
