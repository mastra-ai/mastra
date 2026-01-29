// symbol is used to not leak pubsub to the user
export const PUBSUB_SYMBOL = Symbol('pubsub');
export const STREAM_FORMAT_SYMBOL = Symbol('stream_format');
// symbol used to pass nested workflow runId from execute to step handler
export const NESTED_WORKFLOW_RESULT_SYMBOL = Symbol('nested_workflow_result');
