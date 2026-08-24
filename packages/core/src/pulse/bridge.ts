import { createHash, randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import { TracingEventType } from '../observability';
import type {
  FeedbackEvent,
  LogEvent,
  MetricEvent,
  ObservabilityDropEvent,
  ObservabilityExporter,
  ScoreEvent,
  TracingEvent,
} from '../observability';
import type { PulseEndpointKind, PulseRecord, PulseSemanticType } from '../storage/domains/pulse';
import type { PulseBus } from './bus';
import { nextPulseSeq } from './seq';

/**
 * PulseBridge — the span-side producer of the pulse pipeline (experimental).
 *
 * An {@link ObservabilityExporter} Mastra registers on the default
 * observability instance when `pulse` is configured. It translates span
 * lifecycle events, logs (a log is a pulse), and drop meta-events into
 * pre-shaped pulse/relationship records and emits them onto the
 * {@link PulseBus}. Metric/score/feedback lanes are deliberately NOT
 * translated (metrics are items in a pulse's data; feedback is skipped for
 * now). Nothing derived is emitted: flows, trees, durations and status are
 * reconstructed at read time by the storage domain.
 *
 * The enrichment switch (actions stay verbs): auto-extracted
 * `mastra_model_*_tokens` metrics are never emitted as their own pulses.
 * Their values (plus `costContext.estimatedCost`) are cached by spanId and
 * folded into the semantic model pulse's `data` when its span_ended event
 * arrives — the observability instance emits those metrics synchronously
 * BEFORE the span end event (see `emitSpanEnded` in
 * observability/mastra/src/instances/base.ts), so no timers or races are
 * involved. Duration metrics are dropped entirely (derivable from pulse
 * pairs); any other metric becomes a `metric_recorded` pulse with the metric
 * name in attributes — never as the action.
 */

const SURFACES = new Set([
  'agent',
  'agent_config',
  'agent_controller',
  'background_task',
  'channel',
  'content',
  'context',
  'eval',
  'execution',
  'experiment',
  'memory',
  'model',
  'notification',
  'processor',
  'run_control',
  'schedule',
  'signal',
  'signal_queue',
  'suspension',
  'task',
  'thread',
  'thread_control',
  'tool',
  'tool_approval',
  'tool_config',
  'workflow',
]);

const CORE_REL_TYPES = [
  'origin_of',
  'flow_contains',
  'thread_contains_flow',
  'parent_of',
  'previous_flow',
  'resume_of',
  'external_parent',
  'uses_config_version',
  'uses_instruction_version',
  'uses_model_settings',
  'uses_tool_definition',
  'uses_definition',
  'enables_definition',
  'disables_definition',
  'introduced_content',
  'included_in_model_input',
  'removed_content',
  'replaced_content',
  'compacted_to',
  'queued_signal',
  'drained_signal',
  'queued_follow_up',
  'schedule_triggered',
] as const;

/** Eric's 24-type core vocabulary — a typo here fails at compile time. */
type CoreRelationshipType = (typeof CORE_REL_TYPES)[number];

/** Span types whose semantic end pulse receives the folded token/cost data. */
const MODEL_SPAN_TYPES = new Set(['model_generation', 'model_step', 'model_inference']);

/**
 * Auto-extracted token metric name → data key on the semantic model pulse.
 * Source of truth: observability/mastra/src/metrics/types.ts (TokenMetrics).
 */
export interface PulseBridgeConfig {
  bus: PulseBus;
  /** Serialized payload cap for span input/output in bytes. Default 4096. */
  payloadCapBytes?: number;
  /**
   * Surfaces whose lifecycle facts arrive FIRST-HAND from the source call
   * sites (pulse/lifecycle.ts). Span events mapping to these surfaces are
   * not translated — the native lane owns them. Metric folding, logs and
   * the other event families are unaffected.
   */
  nativeSurfaces?: Iterable<string>;
}

/**
 * Deterministic span-lane pulse id: computed from (traceId, spanId, phase),
 * never remembered. This is what makes cross-process references possible —
 * a resumed run in a NEW process can address the suspended span's pulse by
 * recomputing its id, with zero shared state. The *_started pulse
 * (phase 'started') is a span's identity node in the graph.
 */
export function spanPulseId(traceId: string, spanId: string, phase: 'started' | 'ended'): string {
  return `p_${createHash('sha256').update(`${traceId}:${spanId}:${phase}`).digest('hex').slice(0, 32)}`;
}

/** Collect numeric leaves (dotted keys, depth-limited) — `data` is strictly numeric. */
/** Map a raw usage object to the canonical fold-key token data. */
export function usageTokenData(usage: any): Record<string, number> | undefined {
  if (!usage) return undefined;
  const out: Record<string, number> = {};
  const put = (k: string, v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  };
  put('total_input_tokens', usage.inputTokens);
  put('total_output_tokens', usage.outputTokens);
  put('usage.totalTokens', usage.totalTokens);
  put('input_text_tokens', usage.inputDetails?.text);
  put('input_cache_read_tokens', usage.inputDetails?.cacheRead);
  put('input_cache_write_tokens', usage.inputDetails?.cacheWrite);
  put('input_audio_tokens', usage.inputDetails?.audio);
  put('input_image_tokens', usage.inputDetails?.image);
  put('output_text_tokens', usage.outputDetails?.text);
  put('output_reasoning_tokens', usage.outputDetails?.reasoning);
  put('output_audio_tokens', usage.outputDetails?.audio);
  put('output_image_tokens', usage.outputDetails?.image);
  return Object.keys(out).length ? out : undefined;
}

export function numericLeaves(
  obj: unknown,
  prefix = '',
  depth = 0,
  out: Record<string, number> = {},
): Record<string, number> {
  if (obj == null || depth > 3 || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) numericLeaves(v, key, depth + 1, out);
  }
  return out;
}

function metaStr(span: any, key: string): string {
  const v = span?.metadata?.[key];
  return v == null ? '' : String(v);
}

export function surfaceAction(spanType: string): { surface: string; base: string } {
  switch (spanType) {
    case 'agent_run':
      return { surface: 'agent', base: 'run' };
    case 'model_generation':
      return { surface: 'model', base: 'generate' };
    case 'model_inference':
      return { surface: 'model', base: 'infer' };
    case 'model_step':
      return { surface: 'model', base: 'step' };
    case 'model_chunk':
      return { surface: 'model', base: 'chunk' };
    case 'tool_call':
    case 'mcp_tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
      return { surface: 'tool', base: 'call' };
    case 'workflow_run':
      return { surface: 'workflow', base: 'run' };
    case 'workflow_step':
      return { surface: 'workflow', base: 'step' };
    case 'memory_operation':
      return { surface: 'memory', base: 'operation' };
    case 'scorer_run':
      return { surface: 'eval', base: 'score' };
    case 'scorer_step':
      return { surface: 'eval', base: 'step' };
    case 'processor_run':
      return { surface: 'processor', base: 'run' };
    case 'workflow_conditional':
      return { surface: 'workflow', base: 'conditional' };
    case 'workflow_conditional_eval':
      return { surface: 'workflow', base: 'conditional_eval' };
    case 'workflow_parallel':
      return { surface: 'workflow', base: 'parallel' };
    case 'workflow_loop':
      return { surface: 'workflow', base: 'loop' };
    case 'workflow_sleep':
      return { surface: 'workflow', base: 'sleep' };
    case 'workflow_wait_event':
      return { surface: 'workflow', base: 'wait_event' };
    case 'rag_ingestion':
      return { surface: 'context', base: 'rag_ingestion' };
    case 'rag_embedding':
      return { surface: 'context', base: 'rag_embedding' };
    case 'rag_vector_operation':
      return { surface: 'context', base: 'rag_vector_operation' };
    case 'rag_action':
      return { surface: 'context', base: 'rag_action' };
    case 'graph_action':
      return { surface: 'context', base: 'graph_action' };
    case 'workspace_action':
      return { surface: 'task', base: 'workspace_action' };
    case 'skill_resolution':
      return { surface: 'agent_config', base: 'skill_resolution' };
    case 'mapping':
      return { surface: 'execution', base: 'mapping' };
    case 'generic':
      return { surface: 'execution', base: 'op' };
    default:
      return { surface: 'execution', base: spanType || 'event' };
  }
}

export class PulseBridge extends MastraBase implements ObservabilityExporter {
  name = 'pulse-bridge';
  #bus: PulseBus;
  #payloadCap: number;
  #nativeSurfaces: Set<string>;
  #unmappedSpanTypes = new Set<string>();
  #skippedUpdates = 0;
  /** Token/cost values cached per model spanId, folded at span_ended (see R2/R4). */

  constructor(config: PulseBridgeConfig) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: 'PulseBridge' });
    this.#bus = config.bus;
    this.#payloadCap = config.payloadCapBytes && config.payloadCapBytes > 0 ? config.payloadCapBytes : 4096;
    this.#nativeSurfaces = new Set(config.nativeSurfaces ?? []);
  }

  /**
   * SPAN_UPDATED events are intentionally not translated (each carries a full
   * snapshot; start/end pairs cover the model). Counted so the loss is
   * quantifiable — update/dedupe semantics are an open spec question.
   */
  get skippedUpdateCount(): number {
    return this.#skippedUpdates;
  }

  /** Size-cap a payload: never export unbounded message arrays. */
  #capped(value: unknown): unknown {
    if (value == null) return undefined;
    let s: string;
    try {
      s = JSON.stringify(value);
    } catch {
      return { truncated: true, preview: this.#truncateUtf8(String(value)) };
    }
    if (s == null) return undefined;
    // The cap is BYTES (what storage/wire actually pay), not UTF-16 units —
    // multibyte text would otherwise blow the budget by up to 3x.
    if (Buffer.byteLength(s, 'utf8') <= this.#payloadCap) return value;
    return { truncated: true, preview: this.#truncateUtf8(s) };
  }

  /** Truncate to the byte cap without splitting a multibyte code point. */
  #truncateUtf8(s: string): string {
    const buf = Buffer.from(s, 'utf8');
    if (buf.byteLength <= this.#payloadCap) return s;
    let end = this.#payloadCap;
    // Back off continuation bytes (0b10xxxxxx) to the code-point start.
    while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--;
    return buf.subarray(0, end).toString('utf8');
  }

  #emitPulse(record: PulseRecord): void {
    this.#bus.emit({ type: 'pulse', record });
    // Membership is an explicit edge, not a column convention: every pulse
    // with a flow identity gets one `flow_contains` edge (flow → pulse).
    if (record.traceId) {
      this.#emitRelationship(
        'flow_contains',
        'flow',
        record.traceId,
        'pulse',
        record.id,
        record.traceId,
        record.timestamp,
      );
    }
  }

  #emitRelationship(
    type: CoreRelationshipType,
    fromKind: PulseEndpointKind,
    fromId: string,
    toKind: PulseEndpointKind,
    toId: string,
    traceId: string,
    timestamp: Date,
    attributes?: Record<string, unknown>,
  ): void {
    this.#bus.emit({
      type: 'relationship',
      record: {
        id: randomUUID(),
        timestamp,
        seq: nextPulseSeq(),
        type,
        from: { kind: fromKind, id: fromId },
        to: { kind: toKind, id: toId },
        ...(attributes ? { attributes } : {}),
        traceId,
      },
    });
  }

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    const span: any = event.exportedSpan;
    if (!span) return;

    const { surface, base } = surfaceAction(span.type);
    if (this.#nativeSurfaces.has(surface)) return; // first-hand lane owns it
    const mapped = SURFACES.has(surface);
    if (!mapped) this.#unmappedSpanTypes.add(String(span.type));
    const traceId = span.traceId ?? '';
    const spanId = span.id ?? '';
    const isStart = event.type === TracingEventType.SPAN_STARTED;
    const isEnd = event.type === TracingEventType.SPAN_ENDED;
    if (!isStart && !isEnd) {
      this.#skippedUpdates++;
      return;
    }

    const hasError = Boolean(span.errorInfo);
    const isEventSpan = Boolean(span.isEvent);

    // Semantic type mapping: starts announce state; ends with output are
    // outputs; errors are errors; instantaneous event spans are progress.
    let type: PulseSemanticType;
    let action: string;
    if (isEventSpan) {
      type = 'progress';
      action = base;
    } else if (isStart) {
      type = 'state';
      action = `${base}_started`;
    } else if (hasError) {
      type = 'error';
      action = `${base}_failed`;
    } else {
      type = span.output != null ? 'output' : 'state';
      action = `${base}_completed`;
    }

    const ts: Date = (isEnd && !isEventSpan ? span.endTime : span.startTime) ?? new Date();

    const attributes: Record<string, unknown> = { ...(span.attributes ?? {}) };
    if (!mapped) attributes.spanType = span.type;
    if (isStart || isEventSpan) {
      const input = this.#capped(span.input);
      if (input !== undefined) attributes.input = input;
    }
    if (isEnd) {
      const output = this.#capped(span.output);
      if (output !== undefined) attributes.output = output;
      if (hasError) attributes.error = this.#capped(span.errorInfo);
    }
    const data = numericLeaves(span.attributes?.usage, 'usage');
    numericLeaves(span.attributes?.internalUsage, 'internal_usage', 0, data);
    // Canonical token keys on model facts — metrics are items in `data`,
    // and the read-time cost derivation keys on this one shape.
    if (isEnd && MODEL_SPAN_TYPES.has(String(span.type))) {
      Object.assign(data, usageTokenData(span.attributes?.usage) ?? {});
    }

    // metadata carries only what has no column of its own — runId/threadId/
    // resourceId live ONLY as top-level columns (they are join keys).
    const metadata: Record<string, string> = {};
    {
      const v = metaStr(span, 'environment');
      if (v) metadata.environment = v;
    }
    for (const key of ['entityId', 'entityName', 'entityType'] as const) {
      if (span[key] != null) metadata[key] = String(span[key]);
    }
    if (span.metadata?.resumed) metadata.resumed = 'true';
    if (span.metadata?.resumedFromSpanId) metadata.resumedFromSpanId = String(span.metadata.resumedFromSpanId);

    const pulseId = spanId ? spanPulseId(traceId, spanId, isEnd && !isEventSpan ? 'ended' : 'started') : randomUUID();
    this.#emitPulse({
      id: pulseId,
      timestamp: ts,
      seq: nextPulseSeq(),
      type,
      surface,
      action,
      level: hasError ? 'error' : undefined,
      text: span.name || undefined,
      data,
      attributes,
      metadata,
      traceId,
      spanId: spanId || undefined,
      parentSpanId: span.parentSpanId ?? undefined,
      runId: metaStr(span, 'runId') || undefined,
      threadId: metaStr(span, 'threadId') || undefined,
      resourceId: metaStr(span, 'resourceId') || undefined,
      source: 'span',
    });

    // Structure edges at span START (running flows must have a tree — an
    // end-only graph leaves in-flight runs invisible). Endpoint ids are
    // PULSE RECORD ids; the *_started pulse is the span's identity node.
    if (isStart || isEventSpan) {
      if (span.isRootSpan) this.#emitRelationship('origin_of', 'pulse', pulseId, 'flow', traceId, traceId, ts);
      if (span.parentSpanId) {
        this.#emitRelationship(
          'parent_of',
          'pulse',
          spanPulseId(traceId, span.parentSpanId, 'started'),
          'pulse',
          pulseId,
          traceId,
          ts,
        );
      }
    }

    if (isEnd || isEventSpan) {
      const selfRef = spanId ? spanPulseId(traceId, spanId, 'started') : pulseId;
      // Resumed runs start a new root in the SAME trace, parented to the
      // suspended span — the `resume_of` semantic derives for free. Root-only:
      // children inherit resumedFromSpanId via metadata propagation, and a
      // per-child edge would say every child "continues" the suspended span.
      const resumedFrom = span.isRootSpan ? span.metadata?.resumedFromSpanId : undefined;
      if (resumedFrom) {
        this.#emitRelationship(
          'resume_of',
          'pulse',
          selfRef,
          'pulse',
          spanPulseId(traceId, String(resumedFrom), 'started'),
          traceId,
          ts,
        );
      }
      if (span.type === 'model_generation' || span.type === 'model_inference') {
        const model = span.attributes?.model;
        const provider = span.attributes?.provider;
        if (model) {
          this.#emitRelationship(
            'uses_model_settings',
            'pulse',
            selfRef,
            'definition',
            `model:${provider ?? ''}/${model}`,
            traceId,
            ts,
          );
        }
        const tools = span.attributes?.tools;
        if (Array.isArray(tools)) {
          for (const t of tools) {
            const tn = typeof t === 'string' ? t : t?.name;
            if (tn)
              this.#emitRelationship('uses_tool_definition', 'pulse', selfRef, 'definition', `tool:${tn}`, traceId, ts);
          }
        }
      }
    }
  }

  // ── Non-span event families. Note: these bypass SensitiveDataFilter
  // upstream (they only receive deepClean) — an inherited pipeline property,
  // not compensated for here.

  #baseRecord(source: string, traceId?: string, spanId?: string) {
    return {
      id: randomUUID(),
      timestamp: new Date(),
      seq: nextPulseSeq(),
      traceId: traceId ?? '',
      spanId: spanId || undefined,
      source,
    };
  }

  onLogEvent(event: LogEvent): void {
    const log: any = event.log;
    if (!log) return;
    const level = String(log.level ?? 'info');
    this.#emitPulse({
      ...this.#baseRecord('log', log.traceId, log.spanId),
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      type: level === 'error' || level === 'fatal' ? 'error' : 'system',
      surface: 'execution',
      action: 'log',
      level: level === 'fatal' ? 'error' : level,
      text: String(log.message ?? ''),
      attributes: log.data ?? {},
    });
  }

  // Metrics are not a lane: per the pulse model, a metric is just an item
  // in the `data` field of a pulse. Agent-scope facts carry their usage
  // first-hand at the call sites — there is no translation from
  // observability metric events. Scores and feedback are skipped for the
  // prototype (maintainer direction).

  onDroppedEvent(event: ObservabilityDropEvent): void {
    if (!event) return;
    this.#emitPulse({
      ...this.#baseRecord('drop'),
      type: 'system',
      surface: 'execution',
      action: 'events_dropped',
      data: { count: event.count ?? 0 },
      attributes: {
        signal: event.signal,
        reason: event.reason,
        exporterName: event.exporterName,
      },
    });
  }

  async flush(): Promise<void> {
    // Transitive drain: observability.flush() (durable engines' pre-freeze
    // hook) reaches the bridge via the o11y bus — without this, its promise
    // resolves while pulse rows still sit in writer buffers, and a process
    // freeze right after loses them. The bridge is not a pulse-bus exporter,
    // so this cannot recurse.
    await this.#bus.flush();
  }

  async shutdown(): Promise<void> {
    if (this.#unmappedSpanTypes.size) {
      this.logger.debug(`pulse unmapped span types: ${[...this.#unmappedSpanTypes].join(', ')}`);
    }
    if (this.#skippedUpdates) {
      this.logger.debug(`pulse skipped ${this.#skippedUpdates} span_updated events`);
    }
  }
}
