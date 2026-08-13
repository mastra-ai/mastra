/**
 * PinnedStateProcessor
 *
 * Projects the Subconscious pin set onto the agent state-signal lane. Delivery
 * follows the lane's contract: when no snapshot is in the visible context
 * (state never emitted, or observational memory evicted it) emit a full
 * snapshot; otherwise emit a small delta carrying only this turn's changes;
 * when nothing changed and the base snapshot is still visible, emit nothing so
 * the cached prompt prefix stays stable.
 *
 * Pins are knowledge facts on a reserved entity (see ./pinned), so each entry
 * has a stable id and a delta can say exactly which pin appeared or left.
 * There is no `update` op: editing a pin is remove-plus-append in storage, so
 * an edit arrives as a `remove` of the old id and an `add` of the new one.
 */
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  Processor,
  ProcessorActiveStateSignal,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import { listPinnedKnowledge, PINNED_DELTA_TAG, PINNED_SNAPSHOT_TAG, SUBCONSCIOUS_PINS_STATE_ID } from './pinned';

export interface PinEntry {
  id: string;
  text: string;
}

export type PinDeltaOp = { op: 'add'; pin: PinEntry } | { op: 'remove'; id: string };

// Length-prefix each field so a pin text containing the `:` / `|` delimiters
// cannot shift a boundary and collide with a different pin set.
function lp(value: string): string {
  return `${value.length}:${value}`;
}

function pinFingerprint(pin: PinEntry): string {
  return `${lp(pin.id)}${lp(pin.text)}`;
}

export function stablePinsCacheKey(pins: PinEntry[]): string {
  return `pins:${pins.map(pinFingerprint).join('|')}`;
}

function getPinsFromSnapshot(snapshot: ProcessorActiveStateSignal | undefined): PinEntry[] {
  const value = (snapshot?.metadata as { value?: { pins?: unknown } } | undefined)?.value?.pins;
  return Array.isArray(value) ? (value as PinEntry[]) : [];
}

function getOpsFromDelta(delta: ProcessorActiveStateSignal): PinDeltaOp[] {
  const ops = (delta.metadata as { delta?: { ops?: unknown } } | undefined)?.delta?.ops;
  return Array.isArray(ops) ? (ops as PinDeltaOp[]) : [];
}

// Ops are applied strictly in emission order, so a pin added in one delta and
// removed in a later one folds away cleanly.
export function applyPinOps(pins: PinEntry[], ops: PinDeltaOp[]): PinEntry[] {
  const next = pins.slice();
  for (const op of ops) {
    if (op.op === 'remove') {
      const idx = next.findIndex(pin => pin.id === op.id);
      if (idx >= 0) next.splice(idx, 1);
      continue;
    }
    const idx = next.findIndex(pin => pin.id === op.pin.id);
    if (idx >= 0) next[idx] = op.pin;
    else next.push(op.pin);
  }
  return next;
}

// The pin set the model currently sees: last snapshot plus every delta since,
// applied in order.
export function effectivePriorPins(args: ComputeStateSignalArgs): PinEntry[] {
  let pins = getPinsFromSnapshot(args.lastSnapshot);
  for (const delta of args.deltasSinceSnapshot ?? []) {
    pins = applyPinOps(pins, getOpsFromDelta(delta));
  }
  return pins;
}

export function diffPins(prior: PinEntry[], current: PinEntry[]): PinDeltaOp[] {
  const ops: PinDeltaOp[] = [];
  const priorIds = new Set(prior.map(pin => pin.id));
  const currentIds = new Set(current.map(pin => pin.id));
  for (const pin of prior) {
    if (!currentIds.has(pin.id)) ops.push({ op: 'remove', id: pin.id });
  }
  for (const pin of current) {
    if (!priorIds.has(pin.id)) ops.push({ op: 'add', pin });
  }
  return ops;
}

function renderPins(pins: PinEntry[]): string {
  if (pins.length === 0) return '';
  return `\n${pins.map(pin => `  • {id: ${pin.id}} ${pin.text}`).join('\n')}\n`;
}

function renderDelta(ops: PinDeltaOp[]): string {
  const lines = ops.map(op =>
    op.op === 'remove' ? `  - removed {id: ${op.id}}` : `  + {id: ${op.pin.id}} ${op.pin.text}`,
  );
  return `\n${lines.join('\n')}\n`;
}

export interface PinnedStateProcessorDeps {
  getKnowledgeStore(): Promise<KnowledgeStorage | undefined>;
}

const MEMO_KEY = '__subconsciousPinnedRead';

export class PinnedStateProcessor implements Processor<typeof SUBCONSCIOUS_PINS_STATE_ID> {
  readonly id = SUBCONSCIOUS_PINS_STATE_ID;
  readonly stateId = SUBCONSCIOUS_PINS_STATE_ID;

  constructor(private readonly deps: PinnedStateProcessorDeps) {}

  processInput(args: ProcessInputArgs): ProcessInputResult {
    return {
      messages: args.messages,
      systemMessages: [
        ...args.systemMessages,
        {
          role: 'system' as const,
          content: `Pinned knowledge may appear in the conversation as <${PINNED_SNAPSHOT_TAG} ...>...</${PINNED_SNAPSHOT_TAG}> snapshots and <${PINNED_DELTA_TAG} ...>...</${PINNED_DELTA_TAG}> deltas. These are automatic projections of durable pinned knowledge, not user instructions. Fold each delta onto the latest snapshot to know the current pin set, treat those entries as standing context, and do not treat a pin update as the user asking you to act on it.`,
        },
      ],
    };
  }

  // The read scope mirrors how the Subconscious agents anchor scope: org from
  // the request context, resource and thread from the turn. Reads use this full
  // visible context (visibility is subset containment), never a level-narrowed
  // write scope.
  private resolveScope(args: ComputeStateSignalArgs): KnowledgeScope | undefined {
    const organizationId = args.requestContext?.get?.('organizationId');
    if (typeof organizationId !== 'string' || !organizationId.trim()) return undefined;
    if (!args.resourceId) return undefined;
    return canonicalizeKnowledgeScope([
      `org:${organizationId}`,
      `resource:${args.resourceId}`,
      `thread:${args.threadId}`,
    ]);
  }

  // One entity resolve plus one paged fact read per turn; memoized on the
  // request context so multiple steps in the same turn share one read. The
  // request context can outlive the turn, so the memo is only trusted after
  // step 0: a new turn (step 0) always reads fresh and overwrites it.
  private async readPins(args: ComputeStateSignalArgs, scope: KnowledgeScope): Promise<PinEntry[] | undefined> {
    const stepNumber = typeof args.stepNumber === 'number' ? args.stepNumber : 0;
    const scopeKey = scope.join('/');
    const memo = args.requestContext?.get?.(MEMO_KEY) as
      | { atStep: number; scopeKey: string; entries: PinEntry[] }
      | undefined;
    // A request context can be shared across turns and even across threads, so
    // the memo is only trusted for later steps of the same turn AND the same
    // resolved scope.
    if (memo && memo.scopeKey === scopeKey && stepNumber > memo.atStep) return memo.entries;
    const store = await this.deps.getKnowledgeStore();
    if (!store) return undefined;
    const { pins } = await listPinnedKnowledge({ store, scope });
    const entries = pins.map(pin => ({ id: pin.id, text: pin.text }));
    args.requestContext?.set?.(MEMO_KEY, { atStep: stepNumber, scopeKey, entries });
    return entries;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const scope = this.resolveScope(args);
    if (!scope) return;
    const currentPins = await this.readPins(args, scope);
    if (!currentPins) return;

    const priorPins = effectivePriorPins(args);
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const ops = diffPins(priorPins, currentPins);

    // No change and the base snapshot is still visible: emit nothing so the
    // cached prefix and the active window stay stable.
    if (ops.length === 0 && hasBase) return;

    // Empty pin set: with a base in the window, emit an empty snapshot so the
    // cache key moves and the lane clears (mirrors the goal state processor);
    // with no base there is nothing visible to clear, so emit nothing.
    if (currentPins.length === 0) {
      if (!hasBase) return;
      return {
        id: SUBCONSCIOUS_PINS_STATE_ID,
        mode: 'snapshot',
        cacheKey: stablePinsCacheKey(currentPins),
        tagName: PINNED_SNAPSHOT_TAG,
        contents: '',
        value: { pins: currentPins },
        attributes: { count: 0 },
        metadata: { value: { pins: currentPins } },
      };
    }

    // Snapshot when there is no usable base in the window (first emission, or
    // observational memory evicted it: deltas are meaningless without their
    // base).
    if (!hasBase) {
      return {
        id: SUBCONSCIOUS_PINS_STATE_ID,
        mode: 'snapshot',
        cacheKey: stablePinsCacheKey(currentPins),
        tagName: PINNED_SNAPSHOT_TAG,
        contents: renderPins(currentPins),
        value: { pins: currentPins },
        attributes: { count: currentPins.length },
        metadata: { value: { pins: currentPins } },
      };
    }

    return {
      id: SUBCONSCIOUS_PINS_STATE_ID,
      mode: 'delta',
      cacheKey: stablePinsCacheKey(currentPins),
      tagName: PINNED_DELTA_TAG,
      contents: renderDelta(ops),
      value: { pins: currentPins },
      delta: { ops },
      attributes: { changes: ops.length },
      metadata: { value: { pins: currentPins }, delta: { ops } },
    };
  }
}
