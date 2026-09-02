/**
 * Core feature flags for @mastra/core
 *
 * This set tracks which features are available in the current version of @mastra/core.
 * Dependent packages can check for feature availability to ensure compatibility.
 *
 * @example
 * ```ts
 * import { coreFeatures } from "@mastra/core/features"
 *
 * if (coreFeatures.has('workspaces-v1')) {
 *   // Workspace features available
 * }
 * ```
 */
// Add feature flags here as new features are introduced
export const coreFeatures = new Set<string>([
  'observationalMemory',
  'asyncBuffering',
  'request-response-id-rotation',
  'workspaces-v1',
  'datasets',
  'observability:v1.13.2',
  'observability-delta-polling',
  'channels',
  'deploy-diagnosis',
  'model-inference-span',
  'internal-usage-rollup',
  'json-prompt-injection:inline',
  // Processors can declare the span type they are traced as, and the built-in
  // subsystems declare theirs: SKILL_ACTION, AGENT_SIGNAL, and the memory and
  // workspace types for skills, state signals, memory and workspace
  // instructions.
  //
  // A dependent that only needs to know whether one SpanType member exists
  // should test that member for `undefined` instead of importing this set:
  // `@mastra/core/features` is itself a recent subpath, so importing it raises
  // the oldest core the dependent can load against.
  'processor-span-types',
]);
