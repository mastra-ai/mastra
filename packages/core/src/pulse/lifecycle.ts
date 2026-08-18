import { numericLeaves, spanPulseId, surfaceAction } from './bridge';
import { emitPulseFact } from './emitter';
import type { PulseFactInput } from './emitter';
import { mintFactId } from './identity';
import { takeFold } from './metric-fold';

/**
 * First-hand span-lifecycle facts (the 'native' lane).
 *
 * A call site that opens or closes an observability span calls
 * `emitSpanFact(span, phase)` right next to it. The fact reproduces the
 * bridge's translation EXACTLY — same surface/action vocabulary, same
 * deterministic pulse id (`spanPulseId`) and same structure edges — so
 * while both lanes run, the duplicate rows collapse under the idempotent
 * readers (in-memory id sets, ClickHouse `LIMIT 1 BY id`), and turning
 * the bridge off for agent scope changes nothing the readers see.
 *
 * Not mirrored here (deliberate): the token/cost metric fold (cost
 * estimation lives in the observability package's pricing tables — the
 * documented residual on the bridge), and MODEL_CHUNK progress facts
 * (high volume, low reconstruction value).
 */

/**
 * Surfaces covered first-hand by the call-site hooks in this module (plus
 * the signal seams). Mastra passes this to the bridge as `nativeSurfaces`
 * so the span lane stops translating them — the untangling switch.
 */
export const NATIVE_SURFACES = ['agent', 'model', 'tool', 'memory', 'processor'] as const;

/**
 * Site context for SPAN-LESS emission (observability off). Identity is
 * minted from (runId, surface, base, phase, occurrence) — see identity.ts;
 * the flow id is the runId itself. Parentage is COMPUTED: the site names
 * its logical parent and the parent's started-fact id is derived, no
 * ambient context needed.
 */
export interface LifecycleSiteContext {
  runId: string | undefined;
  surface: string;
  base: string;
  /** Logical index within the run (stepIndex for steps); 0 for singletons. */
  occurrence?: number;
  parent?: { surface: string; base: string; occurrence?: number };
  threadId?: string;
  resourceId?: string;
  error?: boolean;
  /** End carried an output (semantic type 'output' instead of 'state'). */
  output?: boolean;
  name?: string;
  /** First-hand token data (fold-key shape) — the read-time cost source. */
  usage?: Record<string, number | undefined>;
}

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

/** The structural subset of a span this module reads. */
export interface SpanFactSource {
  id?: string;
  entityId?: string;
  entityName?: string;
  entityType?: string;
  traceId?: string;
  parentSpanId?: string;
  isRootSpan?: boolean;
  isEvent?: boolean;
  type?: string;
  name?: string;
  startTime?: Date;
  endTime?: Date;
  errorInfo?: unknown;
  attributes?: Record<string, any>;
  metadata?: Record<string, any>;
  output?: unknown;
}

function metaStr(span: SpanFactSource, key: string): string | undefined {
  const v = span.metadata?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

export function emitSpanFact(
  span: SpanFactSource | undefined | null,
  phase: 'started' | 'ended',
  ctx?: LifecycleSiteContext,
): void {
  if (!span?.id || !span.type) {
    if (ctx?.runId) emitMintedFact(phase, ctx as LifecycleSiteContext & { runId: string });
    return;
  }
  const { surface, base } = surfaceAction(String(span.type));
  const traceId = span.traceId ?? '';
  const isEnd = phase === 'ended';
  const isEventSpan = Boolean(span.isEvent);
  const hasError = Boolean(span.errorInfo);

  let type: PulseFactInput['type'];
  let action: string;
  if (isEventSpan) {
    type = 'progress';
    action = base;
  } else if (!isEnd) {
    type = 'state';
    action = `${base}_started`;
  } else if (hasError) {
    type = 'error';
    action = `${base}_failed`;
  } else {
    type = span.output != null ? 'output' : 'state';
    action = `${base}_completed`;
  }

  const pulseId = spanPulseId(traceId, span.id, isEnd && !isEventSpan ? 'ended' : 'started');
  const data = numericLeaves(span.attributes?.usage, 'usage');
  // Token/cost fold — same shared store as the bridge, idempotent take, so
  // both lanes' model end facts carry identical folded data.
  if (isEnd && (span.type === 'model_generation' || span.type === 'model_step' || span.type === 'model_inference')) {
    const folded = takeFold(span.id);
    if (folded) Object.assign(data, folded);
  }
  // First-hand usage from the site wins over anything derived.
  if (ctx?.usage) for (const [k, v] of Object.entries(ctx.usage)) if (typeof v === 'number') data[k] = v;

  const edges: NonNullable<PulseFactInput['edges']> = [];
  if (!isEnd || isEventSpan) {
    if (span.isRootSpan && traceId) edges.push({ type: 'origin_of', to: { kind: 'flow', id: traceId } });
    if (span.parentSpanId) {
      edges.push({
        type: 'parent_of',
        from: { kind: 'pulse', id: spanPulseId(traceId, span.parentSpanId, 'started') },
        to: { kind: 'pulse', id: pulseId },
      });
    }
  }
  if (isEnd || isEventSpan) {
    const selfRef = spanPulseId(traceId, span.id, 'started');
    const resumedFrom = span.isRootSpan ? span.metadata?.resumedFromSpanId : undefined;
    if (resumedFrom) {
      edges.push({
        type: 'resume_of',
        from: { kind: 'pulse', id: selfRef },
        to: { kind: 'pulse', id: spanPulseId(traceId, String(resumedFrom), 'started') },
      });
    }
    if (span.type === 'model_generation' || span.type === 'model_inference') {
      const model = span.attributes?.model;
      const provider = span.attributes?.provider;
      if (model) {
        edges.push({
          type: 'uses_model_settings',
          from: { kind: 'pulse', id: selfRef },
          to: { kind: 'definition', id: `model:${provider ?? ''}/${model}` },
        });
      }
    }
  }

  // metadata mirrors the bridge: only what has no column of its own.
  // Live spans carry entity identity as FIELDS; exported spans lift them
  // into metadata — accept both so the lanes stay identical.
  const metadata: Record<string, string> = {};
  {
    const v = metaStr(span, 'environment');
    if (v) metadata.environment = v;
  }
  for (const key of ['entityId', 'entityName', 'entityType'] as const) {
    const v = metaStr(span, key) ?? (typeof span[key] === 'string' && span[key] ? (span[key] as string) : undefined);
    if (v) metadata[key] = v;
  }

  emitPulseFact({
    id: pulseId,
    timestamp: (isEnd && !isEventSpan ? span.endTime : span.startTime) ?? undefined,
    runId: metaStr(span, 'runId') ?? '',
    traceId,
    spanId: span.id,
    parentSpanId: span.parentSpanId,
    surface,
    action,
    type,
    level: hasError && isEnd ? 'error' : undefined,
    text: span.name || undefined,
    data: Object.keys(data).length ? data : undefined,
    threadId: metaStr(span, 'threadId'),
    resourceId: metaStr(span, 'resourceId'),
    metadata: Object.keys(metadata).length ? metadata : undefined,
    edges: edges.length ? edges : undefined,
  });
}

/** Span-less emission: minted identity, flow = runId, computed parentage. */
function emitMintedFact(phase: 'started' | 'ended', ctx: LifecycleSiteContext & { runId: string }): void {
  const isEnd = phase === 'ended';
  const occ = ctx.occurrence ?? 0;
  const pulseId = mintFactId(ctx.runId, ctx.surface, ctx.base, phase, occ);

  let type: PulseFactInput['type'];
  let action: string;
  if (!isEnd) {
    type = 'state';
    action = `${ctx.base}_started`;
  } else if (ctx.error) {
    type = 'error';
    action = `${ctx.base}_failed`;
  } else {
    type = ctx.output ? 'output' : 'state';
    action = `${ctx.base}_completed`;
  }

  const edges: NonNullable<PulseFactInput['edges']> = [];
  if (!isEnd) {
    if (ctx.surface === 'agent' && ctx.base === 'run') {
      edges.push({ type: 'origin_of', to: { kind: 'flow', id: ctx.runId } });
    }
    if (ctx.parent) {
      edges.push({
        type: 'parent_of',
        from: {
          kind: 'pulse',
          id: mintFactId(ctx.runId, ctx.parent.surface, ctx.parent.base, 'started', ctx.parent.occurrence ?? 0),
        },
        to: { kind: 'pulse', id: pulseId },
      });
    }
  }

  const data: Record<string, number> = {};
  if (ctx.usage) for (const [k, v] of Object.entries(ctx.usage)) if (typeof v === 'number') data[k] = v;

  emitPulseFact({
    id: pulseId,
    runId: ctx.runId,
    traceId: ctx.runId, // the agent run IS the flow
    surface: ctx.surface,
    action,
    type,
    level: ctx.error && isEnd ? 'error' : undefined,
    text: ctx.name,
    data: Object.keys(data).length ? data : undefined,
    threadId: ctx.threadId,
    resourceId: ctx.resourceId,
    edges: edges.length ? edges : undefined,
  });
}
