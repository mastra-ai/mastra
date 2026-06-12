import type { MastraUnion } from '../../action';
import type { RequestContext } from '../../request-context';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';

// =============================================================================
// Goal objective: durable thread state + state-signal projection
// =============================================================================
//
// A goal objective is held in the thread-scoped `threadState` storage domain
// under `type: 'goal'`. It drives the in-loop goal scorer (`goal-step.ts`): the
// agent keeps working until the objective is judged complete or the run budget
// is exhausted. The `GoalStateProcessor` projects the active objective onto the
// agent state-signal lane so the model always knows what it is working toward.
//
// Like the task tools, a within-turn write surfaces the objective on the shared
// `RequestContext` under `GOAL_REQUEST_CONTEXT_KEY`, so the state processor can
// build a snapshot that reflects a mid-turn `setObjective` in the same step.

/** RequestContext key under which the current objective is surfaced within a turn. */
export const GOAL_REQUEST_CONTEXT_KEY = 'mastra:goal';

/** State-signal lane id used for the current objective. */
export const GOAL_STATE_ID = 'goal';

/** `threadState` storage `type` namespace under which the objective is stored. */
export const GOAL_STATE_TYPE = 'goal';

/** Default max goal evaluations before the goal stops. */
export const DEFAULT_GOAL_MAX_RUNS = 50;

/**
 * Default goal-judge system prompt. Ported from MastraCode's `JUDGE_SYSTEM_PROMPT`
 * so the native goal scorer behaves like the original `/goal` judge. A
 * user-supplied `goal.prompt` (or per-objective `prompt`) overrides this.
 */
export const DEFAULT_GOAL_JUDGE_PROMPT = `You are the goal judge. Your decision directly controls whether the assistant continues working toward the goal.

Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied. Compare what the goal asks for against what the assistant has actually produced. Focus on substance, not phrasing.

The goal is complete when its requirements have been fully achieved.
The goal is NOT complete when the assistant should keep working autonomously toward the objective, including when it asked for input that the goal did not explicitly require.
If the goal says to wait for the goal judge, judge, evaluator, or you to respond, approve, verify, validate, or otherwise provide the next signal, treat your own decision as that judge response. Verification can be performed by you unless the goal explicitly says it needs human/user verification.

When the goal is not yet complete, be specific about what still needs to be accomplished and write your feedback as an instruction for what the assistant should do next.`;

/**
 * Effective goal settings resolved per evaluation. `judgeModelId` is `undefined`
 * when neither the objective record nor the agent config supplies a judge model;
 * the goal step treats that as "do nothing".
 */
export interface EffectiveGoalSettings {
  judgeModelId: string | undefined;
  maxRuns: number;
  prompt: string;
}

/** The agent-level goal config the loop step resolves defaults from. */
export interface AgentGoalConfigDefaults {
  judgeModelId?: string;
  maxRuns?: number;
  prompt?: string;
}

/**
 * Apply the precedence rule: ThreadState record value if present, else the
 * agent's `goal` config default, else a built-in default. A record only persists
 * the fields a caller explicitly provided, so unset fields fall back here.
 */
export function resolveEffectiveGoalSettings(
  record: GoalObjectiveRecord | undefined,
  agentDefaults: AgentGoalConfigDefaults | undefined,
): EffectiveGoalSettings {
  return {
    judgeModelId: record?.judgeModelId ?? agentDefaults?.judgeModelId,
    maxRuns: record?.maxRuns ?? agentDefaults?.maxRuns ?? DEFAULT_GOAL_MAX_RUNS,
    prompt: record?.prompt ?? agentDefaults?.prompt ?? DEFAULT_GOAL_JUDGE_PROMPT,
  };
}

// -----------------------------------------------------------------------------
// Thread-state store resolution
// -----------------------------------------------------------------------------

/**
 * Typed in terms of the storage domain's `GoalObjectiveRecord` (the storage
 * contract). The `threadState` domain defines the record so the storage layer
 * does not depend on this tools package; typing the store methods here means any
 * drift between shapes breaks the build at the read/write call sites rather than
 * silently passing the duck-typed `isThreadStateStore` guard.
 */
export type ResolvedGoalStore = {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
  setState(args: { threadId: string; type: string; value: GoalObjectiveRecord }): Promise<void>;
  deleteState(args: { threadId: string; type: string }): Promise<void>;
};

function isThreadStateStore(value: unknown): value is ResolvedGoalStore {
  return (
    !!value &&
    typeof (value as ResolvedGoalStore).getState === 'function' &&
    typeof (value as ResolvedGoalStore).setState === 'function' &&
    typeof (value as ResolvedGoalStore).deleteState === 'function'
  );
}

/** Resolve the thread-scoped state store from a Mastra instance, if available. */
export async function resolveGoalStore(mastra: MastraUnion | undefined): Promise<ResolvedGoalStore | undefined> {
  const store = await mastra?.getStorage?.()?.getStore('threadState');
  return isThreadStateStore(store) ? store : undefined;
}

// -----------------------------------------------------------------------------
// Objective accessors
// -----------------------------------------------------------------------------

/** Read the current objective record for a thread from the store. */
export async function readObjective(
  store: ResolvedGoalStore | undefined,
  threadId: string | undefined,
): Promise<GoalObjectiveRecord | undefined> {
  if (!store || !threadId) return undefined;
  return store.getState<GoalObjectiveRecord>({ threadId, type: GOAL_STATE_TYPE });
}

/**
 * Persist an objective record for a thread, surfacing it on the RequestContext
 * so the state processor reflects the write in the same step.
 */
export async function writeObjective(
  store: ResolvedGoalStore | undefined,
  threadId: string | undefined,
  record: GoalObjectiveRecord,
  requestContext?: RequestContext,
): Promise<void> {
  if (!store || !threadId) return;
  await store.setState({ threadId, type: GOAL_STATE_TYPE, value: record });
  requestContext?.set(GOAL_REQUEST_CONTEXT_KEY, record);
}

/** Drop the objective for a thread. */
export async function clearObjective(
  store: ResolvedGoalStore | undefined,
  threadId: string | undefined,
  requestContext?: RequestContext,
): Promise<void> {
  if (!store || !threadId) return;
  await store.deleteState({ threadId, type: GOAL_STATE_TYPE });
  requestContext?.set(GOAL_REQUEST_CONTEXT_KEY, undefined);
}

function isGoalObjectiveRecord(value: unknown): value is GoalObjectiveRecord {
  return (
    !!value &&
    typeof (value as GoalObjectiveRecord).objective === 'string' &&
    typeof (value as GoalObjectiveRecord).status === 'string'
  );
}

/**
 * Read the within-turn objective a `setObjective` surfaced on the shared
 * RequestContext this step, if any. Returns `null` when the objective was
 * explicitly cleared this step, `undefined` when nothing was carried (so the
 * caller can fall back to the durable store).
 */
export function getObjectiveFromRequestContext(
  requestContext: RequestContext | undefined,
): GoalObjectiveRecord | null | undefined {
  if (!requestContext?.has?.(GOAL_REQUEST_CONTEXT_KEY)) return undefined;
  const carried = requestContext.get(GOAL_REQUEST_CONTEXT_KEY);
  if (carried === undefined) return null;
  return isGoalObjectiveRecord(carried) ? carried : undefined;
}
