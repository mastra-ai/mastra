// Symbol used to inject pubsub into step context without exposing it in the public API.
// Steps can access pubsub via context[PUBSUB_SYMBOL] for internal event publishing.
export const PUBSUB_SYMBOL = Symbol('pubsub');

// Symbol used to pass stream format preferences through step context.
export const STREAM_FORMAT_SYMBOL = Symbol('stream_format');

// Symbol used to hand a nested workflow step its storage v2 parent's `ParentStateLink`, so the
// nested run can store only its changes to a stored version of the parent's state.
export const PARENT_STATE_SYMBOL = Symbol('parent_state');

// Symbol used to give a nested workflow step's run a `setState` that hands back its state with
// the state its changes are relative to, so they're applied to the parent's state then.
export const HAND_BACK_STATE_SYMBOL = Symbol('hand_back_state');

// Abort reason used when workflow code explicitly cancels a run.
export const WORKFLOW_CANCELLED_SYMBOL = Symbol('workflow_cancelled');

// Symbol used to identify results from nested workflow execution.
//
// When a workflow contains another workflow as a step, the inner workflow's execute()
// returns a result wrapped with this symbol. The step handler (handlers/step.ts) checks
// for this symbol to detect nested workflow results and handle them specially - extracting
// the actual result and nested runId for proper state management.
//
// This Symbol is safe to use (unlike PendingMarker) because it stays in-memory within
// a single execution context - it's never serialized to storage or passed between
// distributed engine instances.
export const NESTED_WORKFLOW_RESULT_SYMBOL = Symbol('nested_workflow_result');
