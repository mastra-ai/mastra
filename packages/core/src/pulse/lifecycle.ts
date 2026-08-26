import { emitPulseFact } from './emitter';
import type { PulseFactInput } from './emitter';
import { mintFactId } from './identity';
import { activePulseRun } from './run-context';

export { withPulseRun, activePulseRun } from './run-context';

/**
 * First-hand lifecycle facts (the 'native' lane) — the ONLY lane.
 *
 * A call site that opens or closes a unit of work calls
 * `emitLifecycleFact(phase, ctx)` right next to it. Identity is always
 * MINTED from (runId, surface, base, phase, occurrence) — see
 * identity.ts; the flow id IS the runId. Parentage is COMPUTED: the
 * site names its logical parent and the parent's started-fact id is
 * derived — no span, no tracer, no ambient graph required. Pulse is
 * fully independent of the observability system: with o11y on or off,
 * the same facts with the same ids are written.
 *
 * Sites without a runId in scope inherit the ambient run identity
 * (run-context.ts), entered once around the run's workflow execution.
 */

/**
 * Canonical token-data shape for model end facts — the read-time cost
 * source (pricing.ts consumes these keys). First-hand from the
 * provider's reported usage; detail meters when present, totals always.
 */
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

/** Site context: everything a fact needs, provided where it happens. */
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
  /** First-hand token data (canonical shape) — the read-time cost source. */
  usage?: Record<string, number | undefined>;
  /** Small identity attributes (e.g. model/provider for price resolution). */
  attributes?: Record<string, string | number | boolean | undefined>;
  /** Definition identities this fact used (uses_definition edges). */
  definitionIds?: string[];
  /** Fact time when the site knows it (defaults to emit time). */
  timestamp?: Date;
}

export function emitLifecycleFact(phase: 'started' | 'ended', ctx: LifecycleSiteContext | undefined): void {
  if (!ctx) return;
  // Sites without a runId in scope inherit the ambient run identity.
  const ambient = ctx.runId ? undefined : activePulseRun();
  const runId = ctx.runId ?? ambient?.runId;
  if (!runId) return;

  const isEnd = phase === 'ended';
  const occ = ctx.occurrence ?? 0;
  // A suspend is NOT the terminal: it must not occupy the 'ended' slot,
  // or the resumed run's real terminal would collide with it and readers
  // would pick one nondeterministically.
  const slotOcc = isEnd && ctx.status === 'suspended' ? `${occ}:suspended` : occ;
  const pulseId = mintFactId(runId, ctx.surface, ctx.base, phase, slotOcc);
  // Synthetic node key: pairs started/ended facts and links parents in
  // the tree readers with zero reader changes.
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
      edges.push({ type: 'origin_of', to: { kind: 'flow', id: runId } });
    }
    if (ctx.parent) {
      edges.push({
        type: 'parent_of',
        from: {
          kind: 'pulse',
          id: mintFactId(runId, ctx.parent.surface, ctx.parent.base, 'started', ctx.parent.occurrence ?? 0),
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
    timestamp: ctx.timestamp,
    runId,
    traceId: runId, // the run IS the flow
    spanId: nodeKey,
    parentSpanId: parentKey,
    surface: ctx.surface,
    action,
    type,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    level: ctx.error && isEnd ? 'error' : undefined,
    text: ctx.name,
    data: Object.keys(data).length ? data : undefined,
    threadId: ctx.threadId ?? ambient?.threadId,
    resourceId: ctx.resourceId ?? ambient?.resourceId,
    edges: edges.length ? edges : undefined,
  });
}
