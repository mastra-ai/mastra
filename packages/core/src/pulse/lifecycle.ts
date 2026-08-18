import { numericLeaves, spanPulseId, surfaceAction } from './bridge';
import { emitPulseFact } from './emitter';
import type { PulseFactInput } from './emitter';
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

export function emitSpanFact(span: SpanFactSource | undefined | null, phase: 'started' | 'ended'): void {
  if (!span?.id || !span.type) return;
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
