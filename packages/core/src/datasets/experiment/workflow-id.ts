/**
 * Id of the internal evented workflow that runs durable experiments. Lives in
 * its own file so `mastra/index.ts` can check for it without statically
 * importing `./workflow` (and through it the evented engine).
 */
export const EXPERIMENT_WORKFLOW_ID = '__mastra-experiment';
