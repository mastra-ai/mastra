import { TracingEventType } from '@mastra/core/observability';
import type { PulseExporter } from './exporter';

/**
 * Backfill: replay spans already persisted by the observability storage domain
 * through a {@link PulseExporter}, so historical traces gain a pulse read
 * model. Reuses the exporter's entire translation (types, surfaces,
 * relationships) — the converter only re-synthesizes span lifecycle events.
 *
 * Structural inputs keep this decoupled from storage internals: pass the
 * observability store's `listTraces`/`getTrace` directly.
 */

interface ObservabilityReadLike {
  /** Returns root spans (`spans`) or trace summaries (`traces`) depending on adapter version. */
  listTraces(args: {
    pagination: { page: number; perPage: number };
  }): Promise<{ traces?: Array<{ traceId: string }>; spans?: Array<{ traceId: string }>; pagination?: unknown }>;
  getTrace(args: { traceId: string }): Promise<{ traceId: string; spans?: any[] } | null>;
}

function toExportedSpan(traceId: string, span: any) {
  const startTime = span.startTime ?? span.startedAt;
  const endTime = span.endTime ?? span.endedAt;
  return {
    id: span.id ?? span.spanId,
    traceId,
    name: span.name ?? '',
    type: span.type ?? span.spanType,
    startTime: startTime ? new Date(startTime) : undefined,
    endTime: endTime ? new Date(endTime) : undefined,
    parentSpanId: span.parentSpanId ?? undefined,
    isRootSpan: span.isRootSpan ?? !span.parentSpanId,
    isEvent: Boolean(span.isEvent),
    attributes: span.attributes ?? {},
    metadata: span.metadata ?? {},
    input: span.input,
    output: span.output,
    errorInfo: span.errorInfo,
    entityId: span.entityId,
    entityName: span.entityName,
    entityType: span.entityType,
  };
}

export interface BackfillResult {
  traces: number;
  spans: number;
}

export async function backfillFromObservability(opts: {
  observability: ObservabilityReadLike;
  exporter: PulseExporter;
  pageSize?: number;
  maxTraces?: number;
}): Promise<BackfillResult> {
  const pageSize = opts.pageSize ?? 50;
  const maxTraces = opts.maxTraces ?? Infinity;
  let traces = 0;
  let spans = 0;

  for (let page = 0; traces < maxTraces; page++) {
    const res = await opts.observability.listTraces({ pagination: { page, perPage: pageSize } });
    const list = res.traces ?? res.spans;
    if (!list?.length) break;
    for (const t of list) {
      if (traces >= maxTraces) break;
      const trace = await opts.observability.getTrace({ traceId: t.traceId });
      if (!trace?.spans?.length) continue;
      traces++;
      for (const raw of trace.spans) {
        const span = toExportedSpan(trace.traceId, raw);
        if (!span.id || !span.type) continue;
        spans++;
        if (span.isEvent) {
          await opts.exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
          continue;
        }
        await opts.exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
        if (span.endTime) {
          await opts.exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
        }
      }
    }
    if (list.length < pageSize) break;
  }

  await opts.exporter.flush();
  return { traces, spans };
}
