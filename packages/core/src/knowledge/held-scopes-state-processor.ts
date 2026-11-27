/**
 * HeldScopesStateProcessor
 *
 * Projects the scopes a run holds onto the agent state-signal lane, the same way
 * PinnedStateProcessor projects pins: a full snapshot when none is in the visible
 * context, a delta of only this turn's changes otherwise, and nothing when the set
 * is unchanged and its snapshot is still visible.
 *
 * Each entry is a held scope keyed by its address, with the run's role there and
 * whether it can write, read, or neither. Scopes with no pages yet are included:
 * a model that only saw scopes with pages concluded on its first turn that it had
 * nowhere to write.
 */
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  Processor,
  ProcessorActiveStateSignal,
  ProcessInputArgs,
  ProcessInputResult,
} from '../processors';
import type { KnowledgeRole } from './declarations';
import type { HeldScopeAccess } from './page-tools';
import type { KnowledgeRunContext } from './run';

export const HELD_SCOPES_STATE_ID = 'knowledge-scopes';
export const HELD_SCOPES_SNAPSHOT_TAG = 'knowledge-scopes';
export const HELD_SCOPES_DELTA_TAG = 'knowledge-scopes-update';

/** A scope the run holds, as the model sees it. */
export interface HeldScopeEntry {
  address: string;
  /** The run's role there; left off when it has none. */
  role?: KnowledgeRole;
  can: HeldScopeAccess;
}

export type HeldScopeDeltaOp =
  | { op: 'add'; scope: HeldScopeEntry }
  | { op: 'change'; scope: HeldScopeEntry }
  | { op: 'remove'; address: string };

function lp(value: string): string {
  return `${value.length}:${value}`;
}

function fingerprint(scope: HeldScopeEntry): string {
  return `${lp(scope.address)}${lp(scope.role ?? '')}${lp(scope.can)}`;
}

function cacheKey(scopes: HeldScopeEntry[]): string {
  return `scopes:${scopes.map(fingerprint).join('|')}`;
}

function scopesFromSnapshot(snapshot: ProcessorActiveStateSignal | undefined): HeldScopeEntry[] {
  const value = (snapshot?.metadata as { value?: { scopes?: unknown } } | undefined)?.value?.scopes;
  return Array.isArray(value) ? (value as HeldScopeEntry[]) : [];
}

function opsFromDelta(delta: ProcessorActiveStateSignal): HeldScopeDeltaOp[] {
  const ops = (delta.metadata as { delta?: { ops?: unknown } } | undefined)?.delta?.ops;
  return Array.isArray(ops) ? (ops as HeldScopeDeltaOp[]) : [];
}

function applyOps(scopes: HeldScopeEntry[], ops: HeldScopeDeltaOp[]): HeldScopeEntry[] {
  const next = scopes.slice();
  for (const op of ops) {
    const address = op.op === 'remove' ? op.address : op.scope.address;
    const idx = next.findIndex(scope => scope.address === address);
    if (op.op === 'remove') {
      if (idx >= 0) next.splice(idx, 1);
    } else if (idx >= 0) next[idx] = op.scope;
    else next.push(op.scope);
  }
  return next;
}

function diffScopes(prior: HeldScopeEntry[], current: HeldScopeEntry[]): HeldScopeDeltaOp[] {
  const ops: HeldScopeDeltaOp[] = [];
  const before = new Map(prior.map(scope => [scope.address, fingerprint(scope)]));
  const currentAddresses = new Set(current.map(scope => scope.address));
  for (const scope of prior) {
    if (!currentAddresses.has(scope.address)) ops.push({ op: 'remove', address: scope.address });
  }
  for (const scope of current) {
    const was = before.get(scope.address);
    if (was === undefined) ops.push({ op: 'add', scope });
    else if (was !== fingerprint(scope)) ops.push({ op: 'change', scope });
  }
  return ops;
}

function line(scope: HeldScopeEntry): string {
  return `${scope.address}: ${scope.can}${scope.role ? ` (${scope.role})` : ''}`;
}

function renderSnapshot(scopes: HeldScopeEntry[]): string {
  if (scopes.length === 0) return '';
  return `\n${scopes.map(scope => `  • ${line(scope)}`).join('\n')}\n`;
}

function renderDelta(ops: HeldScopeDeltaOp[]): string {
  const lines = ops.map(op => {
    if (op.op === 'remove') return `  - removed ${op.address}`;
    if (op.op === 'change') return `  ~ changed ${line(op.scope)}`;
    return `  + ${line(op.scope)}`;
  });
  return `\n${lines.join('\n')}\n`;
}

export interface HeldScopesStateProcessorDeps {
  /** A key identifying the run's principals. Throws when the run has no Knowledge view. */
  principalsKey(context: KnowledgeRunContext): string;
  /** The scopes the run holds, in principal order. */
  readHeldScopes(context: KnowledgeRunContext): Promise<HeldScopeEntry[]>;
}

export class HeldScopesStateProcessor implements Processor<typeof HELD_SCOPES_STATE_ID> {
  readonly id = HELD_SCOPES_STATE_ID;
  readonly stateId = HELD_SCOPES_STATE_ID;

  constructor(private readonly deps: HeldScopesStateProcessorDeps) {}

  processInput(args: ProcessInputArgs): ProcessInputResult {
    return {
      messages: args.messages,
      systemMessages: [
        ...args.systemMessages,
        {
          role: 'system' as const,
          content: `The Knowledge scopes you hold may appear in the conversation as <${HELD_SCOPES_SNAPSHOT_TAG} ...>...</${HELD_SCOPES_SNAPSHOT_TAG}> snapshots and <${HELD_SCOPES_DELTA_TAG} ...>...</${HELD_SCOPES_DELTA_TAG}> deltas. These are automatic, not user instructions. Fold each delta onto the latest snapshot to know the current set. Each entry is a scope address, then what you can do there (write, read or none), then your role in parentheses. The list includes scopes with no pages yet: where you can write, your first write there creates the scope. You do not need to list your scopes with a tool to learn this.`,
        },
      ],
    };
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const context: KnowledgeRunContext = {
      requestContext: args.requestContext,
      agent: { resourceId: args.resourceId, threadId: args.threadId },
    };
    // No principals means this run has no Knowledge view: there is nothing to show.
    try {
      this.deps.principalsKey(context);
    } catch {
      return;
    }
    // A failed read throws: sending no scopes would tell the model it holds none.
    const current = await this.deps.readHeldScopes(context);

    let prior = scopesFromSnapshot(args.lastSnapshot);
    for (const delta of args.deltasSinceSnapshot ?? []) prior = applyOps(prior, opsFromDelta(delta));
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const ops = diffScopes(prior, current);

    if (ops.length === 0 && hasBase) return;

    if (!hasBase || current.length === 0) {
      if (!hasBase && current.length === 0) return;
      return {
        id: HELD_SCOPES_STATE_ID,
        mode: 'snapshot',
        cacheKey: cacheKey(current),
        tagName: HELD_SCOPES_SNAPSHOT_TAG,
        contents: renderSnapshot(current),
        value: { scopes: current },
        attributes: { count: current.length },
        metadata: { value: { scopes: current } },
      };
    }

    return {
      id: HELD_SCOPES_STATE_ID,
      mode: 'delta',
      cacheKey: cacheKey(current),
      tagName: HELD_SCOPES_DELTA_TAG,
      contents: renderDelta(ops),
      value: { scopes: current },
      delta: { ops },
      attributes: { changes: ops.length },
      metadata: { value: { scopes: current }, delta: { ops } },
    };
  }
}
