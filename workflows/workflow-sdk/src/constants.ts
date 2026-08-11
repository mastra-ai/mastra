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

/**
 * Identity prefix echoed back for `pause` ops (perStep execution mode).
 *
 * Like `finalize`, a pause addresses no graph node; unlike `finalize` a run can
 * pause many times, so the pause sequence number is appended to keep every
 * pause's identity — and therefore the replay guard — unique.
 */
export const PAUSE_IDENTITY_PREFIX = 'pause@';

/**
 * Key under which a paused run's hook token is stored in the snapshot's
 * suspend-token map. Reserved: it can never collide with a step id because
 * Mastra step ids come from user graphs and this one is namespaced.
 */
export const PER_STEP_TOKEN_KEY = '__perStep';
