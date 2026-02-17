// Symbol used to inject pubsub into step context without exposing it in the public API.
// Steps can access pubsub via context[PUBSUB_SYMBOL] for internal event publishing.
export const PUBSUB_SYMBOL = Symbol('pubsub');

// Symbol used to pass stream format preferences through step context.
export const STREAM_FORMAT_SYMBOL = Symbol('stream_format');

// Symbol used to pass scoped nested-watch topic through step context.
// When a run starts, it creates a scoped topic `nested-watch:${runId}` and threads it
// through the execution chain. Nested workflows publish child events to this topic
// instead of the global 'nested-watch', preventing feedback loops when parent and child
// share the same pubsub instance.
export const NESTED_WATCH_TOPIC_SYMBOL = Symbol('nested_watch_topic');

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
