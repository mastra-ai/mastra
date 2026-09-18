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

function stableObjectiveCacheKey(record: GoalObjectiveRecord): string {
  // Identity of a projection: the objective it renders, plus its status. The
  // progress fields (`runsUsed`, `maxRuns`) are deliberately excluded — a judge
  // pass advances `runsUsed` every attempt, so keying on it would make the key
  // differ from the previous projection on every step and re-add an unchanged
  // objective to the window. The projection is append-only, so re-adding it
  // duplicates context rather than updating it. Whether the objective is
  // already in the window is what decides re-emission; the attempt count is
  // carried by the goal-judge reminder, which is emitted per attempt.
  return `goal:${lp(record.objective)}${lp(record.status)}`;
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
    const prior = this.getPriorObjective(args);
    // Current objective for this turn: the within-turn write a `setObjective`
    // surfaced on the shared RequestContext this step, else the durable store.
    const carried = getObjectiveFromRequestContext(args.requestContext);
    const cached = takeCachedGoalObjective(args.requestContext, args.threadId);
    let current: GoalObjectiveRecord | undefined;
    if (carried === null) {
      current = undefined; // explicitly cleared this step
    } else if (carried !== undefined) {
      current = carried;
    } else if (cached?.objective) {
      current = cached.objective;
    } else {
      // No carried write and no cached objective: read the store. A cache entry
      // without an objective carries no information — treating it as "no goal"
      // would retract an objective the store reports as active.
      const store = await this.resolveStore();
      if (store) {
        current = await store.getState<GoalObjectiveRecord>({ threadId: args.threadId, type: GOAL_STATE_TYPE });
      } else {
        // No store to read: the objective is unknown, not absent. An unreadable
        // store must not be reported to the model as `status: none` — that
        // reads as "the goal was cancelled" and abandons the run. Keep the last
        // projection instead; a genuine clear/complete goes through the store
        // and still retracts below.
        current = prior;
      }
    }

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
    const cacheKey = stableObjectiveCacheKey(current);
    const priorCacheKey = prior ? stableObjectiveCacheKey(prior) : undefined;

    // No change and the base snapshot is still in the window: emit nothing so the
    // cached prefix stays stable. This is what keeps an already-projected
    // objective from being appended again on every step.
    if (hasBase && priorCacheKey === cacheKey) return;

    return {
      id: GOAL_STATE_ID,
      cacheKey,
      mode: 'snapshot',
      tagName: 'current-objective',
      contents: renderObjective(current),
      value: { objective: current },
      // Only stable fields here: an attribute that advances per attempt cannot
      // be kept current by an append-only snapshot, and would contradict the
      // goal-judge reminder that reports the live attempt count.
      attributes: { status: current.status },
      metadata: { value: { objective: current } },
    };
  }
}
