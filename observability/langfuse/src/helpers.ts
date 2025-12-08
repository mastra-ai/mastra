/**
 * Langfuse Tracing Options Helpers
 *
 * These helpers integrate with the `buildTracingOptions` pattern from
 * `@mastra/observability` to add Langfuse-specific tracing features.
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

import type { TracingOptionsUpdater } from '@mastra/observability';

/**
 * Langfuse prompt input - accepts either a Langfuse SDK prompt object
 * or manual fields.
 */
export interface LangfusePromptInput {
  /** Prompt name */
  name?: string;
  /** Prompt version */
  version?: number;
  /** Prompt UUID */
  id?: string;
}

/**
 * Adds Langfuse prompt metadata to the tracing options
 * to enable Langfuse Prompt Tracing.
 *
 * The metadata is added under `metadata.langfuse.prompt` and includes:
 * - `name` - Prompt name
 * - `version` - Prompt version
 * - `id` - Prompt UUID
 *
 * All fields are deeply merged with any existing metadata.
 *
 * @param prompt - A Langfuse prompt object (from `langfuse.getPrompt()`) or manual fields
 * @returns A TracingOptionsUpdater function for use with `buildTracingOptions`
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangfusePrompt } from '@mastra/langfuse';
 * import { Langfuse } from 'langfuse';
 *
 * const langfuse = new Langfuse();
 * const prompt = await langfuse.getPrompt('customer-support');
 *
 * // Use with buildTracingOptions
 * const tracingOptions = buildTracingOptions(
 *   withLangfusePrompt(prompt),
 * );
 *
 * // Or directly in agent config
 * const agent = new Agent({
 *   name: 'support-agent',
 *   instructions: prompt.prompt,
 *   model: openai('gpt-4o'),
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(withLangfusePrompt(prompt)),
 *   },
 * });
 *
 * // Manual fields also work
 * const tracingOptions = buildTracingOptions(
 *   withLangfusePrompt({ name: 'my-prompt', version: 1 }),
 * );
 * ```
 */
export function withLangfusePrompt(prompt: LangfusePromptInput): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    metadata: {
      ...opts.metadata,
      langfuse: {
        ...(opts.metadata?.langfuse as Record<string, unknown>),
        prompt: {
          ...(prompt.name !== undefined && { name: prompt.name }),
          ...(prompt.version !== undefined && { version: prompt.version }),
          ...(prompt.id !== undefined && { id: prompt.id }),
        },
      },
    },
  });
}
