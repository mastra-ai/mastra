/**
 * Workflow id used by the bg-task workflow registered on Mastra.
 * Double-underscore prefix marks it as internal — same convention as
 * `__batch-scoring-traces`.
 *
 * Lives in its own file (separate from `./workflow`) so `manager.ts` can
 * reference the id without statically pulling in `../workflows/evented`,
 * which would create a circular import via `agent → background-tasks →
 * workflow → evented → workflows/index → agent`.
 */
export const BACKGROUND_TASK_WORKFLOW_ID = '__background-task';
