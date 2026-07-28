/**
 * Constants shared by the sandboxed workflow runner and the host runtime.
 *
 * This file has no imports on purpose: it is reachable from the `"use workflow"`
 * module graph, which must not pull in `@mastra/core` or Node builtins.
 */

/** Value written to `Workflow#engineType` for Workflow SDK-backed workflows. */
export const WORKFLOW_SDK_ENGINE_TYPE = 'workflow-sdk';

/**
 * Workflow SDK stream namespace carrying Mastra workflow events.
 *
 * The runner writes here via `getWritable({ namespace })`; `WorkflowSdkRun#watch()`
 * and `#stream()` read the other end with `getRun(id).getReadable({ namespace })`.
 */
export const MASTRA_EVENT_NAMESPACE = 'mastra:events';

/**
 * Identity echoed back for the `finalize` op.
 *
 * The walker checks every response's identity against the node it is standing
 * on, because all ops share one step function and the runtime's own replay
 * guard compares only that function's name. `finalize` addresses no node, so it
 * gets this constant instead of a path — and it lives here rather than in the
 * executor so the sandbox-safe walker can compare against it without importing
 * host code.
 */
export const FINALIZE_IDENTITY = 'finalize@';
