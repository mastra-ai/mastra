// =============================================================================
// Goal built-in
// =============================================================================
//
// A goal is a durable, thread-scoped objective that the agent works toward
// across loop iterations until it is judged complete or the run budget is
// exhausted. This module co-locates the goal primitives:
//
// - `objective`       durable thread-state record + accessors + settings resolution
// - `scorer`          LLM-as-judge that grades the latest output against the objective
// - `state-processor` projects the active objective onto the agent state-signal lane
// - `signal-provider` bundles the state processor for auto-registration on an agent
//
// The in-loop goal step that calls the scorer lives with the other loop steps
// in `loop/workflows/agentic-execution/goal-step.ts`.

export {
  GOAL_STATE_ID,
  GOAL_STATE_TYPE,
  GOAL_REQUEST_CONTEXT_KEY,
  DEFAULT_GOAL_JUDGE_PROMPT,
  DEFAULT_GOAL_MAX_RUNS,
  GOAL_SCORE_WAITING,
  GOAL_SCORER_ID,
  resolveGoalStore,
  resolveEffectiveGoalSettings,
  readObjective,
  writeObjective,
  clearObjective,
  getObjectiveFromRequestContext,
  type EffectiveGoalSettings,
  type AgentGoalConfigDefaults,
  type ResolvedGoalStore,
} from './objective';

export { beginGoalActivity, stopGoalActivity, getGoalActivityDurationMs } from './activity';

export { createGoalScorer } from './scorer';

export { GoalStateProcessor } from './state-processor';

export { GoalSignalProvider } from './signal-provider';
