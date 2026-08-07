import type { Mastra } from '../../mastra';
import type { ComputeStateSignalArgs, ComputeStateSignalResult } from '../../processors/index';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';
import { takeCachedGoalObjective } from './activity-cache';
import { getObjectiveFromRequestContext, GOAL_STATE_ID, GOAL_STATE_TYPE, resolveGoalStore } from './objective';

// =============================================================================
// Goal state processor
// =============================================================================
//
// Carries the agent's current objective on the agent state-signal lane
// (`stateId: 'goal'`) so the model always knows what it is working toward.
//
// Unlike the task list, the objective is small and changes infrequently, so this
// processor is snapshot-only: every emission is a full `<current-objective>`
// snapshot. It emits when the objective (text/status/runsUsed/maxRuns) changes,
// re-snapshots when observational memory drops the base from the window, and
// otherwise stays silent so the cached prefix is not invalidated.
//
// The objective itself lives in the thread-scoped `threadState` domain under
// `type: 'goal'`; this processor projects it onto the model context. State
// signals require a memory-backed thread; the runtime enforces this.

// Renders the inner body of the objective signal. The state-signal framework
// wraps (and XML-escapes) this string inside the signal's `tagName`
// (`current-objective`), so this returns only the body — wrapping it in the tag
// here would double-wrap the markup the model sees.
function renderObjective(record: GoalObjectiveRecord): string {
  return `\n  ${record.objective}\n`;
}

// Length-prefix each field so a value containing the delimiters cannot shift a
// boundary. The cache key changes whenever any rendered field changes, so an
// unchanged objective emits nothing.
function lp(value: string): string {
  return `${value.length}:${value}`;
}

function stableObjectiveCacheKey(record: GoalObjectiveRecord, maxRuns: number): string {
  return `goal:${lp(record.objective)}${lp(record.status)}${lp(String(record.runsUsed))}${lp(String(maxRuns))}`;
}

type ResolvedThreadStateStore = {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
};

/**
 * Input processor that publishes the agent's current objective as a state
 * signal. Auto-registered when an agent is configured with `goal`, or added
 * explicitly via {@link GoalSignalProvider}.
 */
export class GoalStateProcessor {
  readonly id = 'goal-state';
  readonly stateId = GOAL_STATE_ID;

  // See the matching note in `task-state-processor.ts`: we keep all imports from
  // `processors/index` type-only and implement this hook inline to avoid an
  // initialization cycle through the processors runtime graph.
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  private async resolveStore(): Promise<ResolvedThreadStateStore | undefined> {
    return resolveGoalStore(this.mastra as any);
  }

  private getPriorObjective(args: ComputeStateSignalArgs): GoalObjectiveRecord | undefined {
    const value = args.lastSnapshot?.metadata?.value as { objective?: GoalObjectiveRecord } | undefined;
    return value?.objective;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    // Current objective for this turn: the within-turn write a `setObjective`
    // surfaced on the shared RequestContext this step, else the durable store.
    const carried = getObjectiveFromRequestContext(args.requestContext);
    const cached = takeCachedGoalObjective(args.requestContext, args.threadId);
    let current: GoalObjectiveRecord | undefined;
    if (carried === null) {
      current = undefined; // explicitly cleared this step
    } else if (carried !== undefined) {
      current = carried;
    } else if (cached) {
      current = cached.objective ?? undefined;
    } else {
      const store = await this.resolveStore();
      current = store
        ? await store.getState<GoalObjectiveRecord>({ threadId: args.threadId, type: GOAL_STATE_TYPE })
        : undefined;
    }

    const prior = this.getPriorObjective(args);
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;

    // Only project an active objective. A done/paused/cleared objective is not
    // surfaced to the model (the loop will not act on it either). But if a prior
    // `<current-objective>` snapshot is still in the window, emit an empty
    // snapshot to retract it — otherwise the model keeps seeing a stale goal
    // until observational memory drops the base.
    if (!current || current.status !== 'active') {
      // Nothing in-window to retract, or the prior snapshot was already the
      // empty retraction — emit nothing so the cached prefix stays stable.
      if (!hasBase || !prior) return;
      return {
        id: GOAL_STATE_ID,
        cacheKey: 'goal:none',
        mode: 'snapshot',
        tagName: 'current-objective',
        contents: '\n',
        value: { objective: undefined },
        attributes: { status: 'none' },
        metadata: { value: { objective: undefined } },
      };
    }
    const maxRuns = current.maxRuns ?? prior?.maxRuns ?? 0;
    const cacheKey = stableObjectiveCacheKey(current, maxRuns);
    const priorCacheKey = prior ? stableObjectiveCacheKey(prior, prior.maxRuns ?? 0) : undefined;

    // No change and the base snapshot is still in the window: emit nothing so the
    // cached prefix stays stable.
    if (hasBase && priorCacheKey === cacheKey) return;

    return {
      id: GOAL_STATE_ID,
      cacheKey,
      mode: 'snapshot',
      tagName: 'current-objective',
      contents: renderObjective(current),
      value: { objective: current },
      attributes: {
        status: current.status,
        runsUsed: current.runsUsed,
        ...(maxRuns ? { maxRuns } : {}),
      },
      metadata: { value: { objective: current } },
    };
  }
}
