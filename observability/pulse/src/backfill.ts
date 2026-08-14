import { TracingEventType } from '@mastra/core/observability';
import { PulseBridge, PulseBus, PulseStorageExporter } from '@mastra/core/pulse';
import type { PulseStorage } from '@mastra/core/storage';

/**
 * Backfill: replay spans already persisted by the observability storage domain
 * through the core {@link PulseBridge}, so historical traces gain a pulse read
 * model. Reuses the bridge's entire translation (types, surfaces,
 * relationships) — the converter only re-synthesizes span lifecycle events.
 *
 * Two sinks:
 * - `bus`: emit onto an existing PulseBus (caller owns its exporters/lifecycle)
 * - `storage`: convenience — an internal bus + `PulseStorageExporter` are
 *   created and shut down around the run.
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

export interface BackfillOptions {
  observability: ObservabilityReadLike;
  /** Existing PulseBus to emit onto. Mutually exclusive with `storage`. */
  bus?: PulseBus;
  /** Pulse storage to write through (an internal bus/writer is managed for you). */
  storage?: PulseStorage;
  pageSize?: number;
  maxTraces?: number;
}

export async function backfillFromObservability(opts: BackfillOptions): Promise<BackfillResult> {
  if (!opts.bus && !opts.storage) {
    throw new Error('backfillFromObservability requires either `bus` or `storage`');
  }
  const ownsBus = !opts.bus;
  const bus = opts.bus ?? new PulseBus();
  if (ownsBus) {
    bus.registerExporter(new PulseStorageExporter({ storage: opts.storage! }));
  }
  const bridge = new PulseBridge({ bus });

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
          await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
          continue;
        }
        await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
        if (span.endTime) {
          await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
        }
      }
    }
    if (list.length < pageSize) break;
  }

  await bridge.flush();
  if (ownsBus) {
    await bus.shutdown();
  } else {
    await bus.flush();
  }
  return { traces, spans };
}
