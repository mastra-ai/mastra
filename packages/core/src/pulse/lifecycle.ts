import { numericLeaves, spanPulseId, surfaceAction, usageTokenData } from './bridge';

export { usageTokenData };
import { emitPulseFact } from './emitter';
import type { PulseFactInput } from './emitter';
import { mintFactId } from './identity';
import { activePulseRun } from './run-context';

export { withPulseRun, activePulseRun } from './run-context';

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
 * Not mirrored here (deliberate): stored cost (cost is DERIVED at read
 * time from usage on model end facts x pulse's own versioned model_prices
 * table — see pricing.ts), and MODEL_CHUNK progress facts
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
  /** Explicit run identity; when absent, the ambient run context is used. */
  runId?: string | undefined;
  surface: string;
  base: string;
  /** Logical key within the run: index (stepIndex) or natural string key. */
  occurrence?: number | string;
  parent?: { surface: string; base: string; occurrence?: number | string };
  threadId?: string;
  resourceId?: string;
  error?: boolean;
  /**
   * Non-completed terminal for an end fact: 'aborted' is a TERMINAL the
   * readers derive status from; 'suspended' is deliberately NON-terminal
   * (the flow stays open until resume completes or staleness closes it).
   */
  status?: 'aborted' | 'suspended';
  /** End carried an output (semantic type 'output' instead of 'state'). */
  output?: boolean;
  name?: string;
  /** First-hand token data (fold-key shape) — the read-time cost source. */
  usage?: Record<string, number | undefined>;
  /** Small identity attributes (e.g. model/provider for price resolution). */
  attributes?: Record<string, string | number | boolean | undefined>;
  /** Definition identities this fact used (uses_definition edges). */
  definitionIds?: string[];
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
    if (!ctx) return;
    // Sites without a runId in scope inherit the ambient run identity.
    const ambient = ctx.runId ? undefined : activePulseRun();
    const runId = ctx.runId ?? ambient?.runId;
    if (runId) {
      emitMintedFact(phase, {
        ...ctx,
        runId,
        threadId: ctx.threadId ?? ambient?.threadId,
        resourceId: ctx.resourceId ?? ambient?.resourceId,
      });
    }
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
  } else if (ctx?.status) {
    // Aborted/suspended ends must not masquerade as completed.
    type = 'state';
    action = `${base}_${ctx.status}`;
  } else {
    type = span.output != null ? 'output' : 'state';
    action = `${base}_completed`;
  }

  const pulseId = spanPulseId(traceId, span.id, isEnd && !isEventSpan ? 'ended' : 'started');
  const data = numericLeaves(span.attributes?.usage, 'usage');
  // First-hand usage from the site wins over anything derived.
  if (ctx?.usage) for (const [k, v] of Object.entries(ctx.usage)) if (typeof v === 'number') data[k] = v;

  const edges: NonNullable<PulseFactInput['edges']> = [];
  if (!isEnd || isEventSpan) {
    if (span.isRootSpan && traceId) edges.push({ type: 'origin_of', to: { kind: 'flow', id: traceId } });
    for (const def of ctx?.definitionIds ?? []) {
      edges.push({ type: 'uses_definition' as any, to: { kind: 'definition', id: def } });
    }
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

  // Site attributes (model/provider identity for price resolution) are
  // first-hand on BOTH paths — the span carries none of them itself.
  const attributes: Record<string, unknown> = {};
  if (ctx?.attributes) for (const [k, v] of Object.entries(ctx.attributes)) if (v !== undefined) attributes[k] = v;

  emitPulseFact({
    id: pulseId,
    timestamp: (isEnd && !isEventSpan ? span.endTime : span.startTime) ?? undefined,
    runId: metaStr(span, 'runId') ?? ctx?.runId ?? '',
    traceId,
    spanId: span.id,
    parentSpanId: span.parentSpanId,
    surface,
    action,
    type,
    attributes: Object.keys(attributes).length ? attributes : undefined,
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
  // A suspend is NOT the terminal: it must not occupy the 'ended' slot,
  // or the resumed run's real terminal would collide with it and readers
  // would pick one nondeterministically.
  const slotOcc = isEnd && ctx.status === 'suspended' ? `${occ}:suspended` : occ;
  const pulseId = mintFactId(ctx.runId, ctx.surface, ctx.base, phase, slotOcc);
  // Synthetic node key: lets the existing span-keyed tree readers pair
  // started/ended minted facts and link parents with zero reader changes.
  const nodeKey = `${ctx.surface}.${ctx.base}.${occ}`;
  const parentKey = ctx.parent ? `${ctx.parent.surface}.${ctx.parent.base}.${ctx.parent.occurrence ?? 0}` : undefined;

  let type: PulseFactInput['type'];
  let action: string;
  if (!isEnd) {
    type = 'state';
    action = `${ctx.base}_started`;
  } else if (ctx.error) {
    type = 'error';
    action = `${ctx.base}_failed`;
  } else if (ctx.status) {
    type = 'state';
    action = `${ctx.base}_${ctx.status}`;
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
    for (const def of ctx.definitionIds ?? []) {
      edges.push({ type: 'uses_definition' as any, to: { kind: 'definition', id: def } });
    }
  }

  const data: Record<string, number> = {};
  if (ctx.usage) for (const [k, v] of Object.entries(ctx.usage)) if (typeof v === 'number') data[k] = v;

  const attributes: Record<string, unknown> = {};
  if (ctx.attributes) for (const [k, v] of Object.entries(ctx.attributes)) if (v !== undefined) attributes[k] = v;

  emitPulseFact({
    id: pulseId,
    runId: ctx.runId,
    traceId: ctx.runId, // the agent run IS the flow
    spanId: nodeKey,
    parentSpanId: parentKey,
    surface: ctx.surface,
    action,
    type,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    level: ctx.error && isEnd ? 'error' : undefined,
    text: ctx.name,
    data: Object.keys(data).length ? data : undefined,
    threadId: ctx.threadId,
    resourceId: ctx.resourceId,
    edges: edges.length ? edges : undefined,
  });
}
