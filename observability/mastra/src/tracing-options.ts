/**
 * Composable Tracing Options Builder
 */

import type { TracingOptions } from '@mastra/core/observability';

/**
 * A function that updates TracingOptions.
 */
export type TracingOptionsUpdater = (options: TracingOptions) => TracingOptions;

/**
 * Builds TracingOptions by composing one or more updater functions.
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangfusePrompt } from '@mastra/langfuse';
 *
 * const prompt = await langfuse.getPrompt('my-prompt');
 *
 * const agent = new Agent({
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(withLangfusePrompt(prompt)),
 *   },
 * });
 * ```
 */
export function buildTracingOptions(...updaters: TracingOptionsUpdater[]): TracingOptions {
  return updaters.reduce((opts, updater) => updater(opts), {} as TracingOptions);
}
