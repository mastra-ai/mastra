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
 * const agent = new Agent({
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(
 *       withLangfusePrompt({ name: 'my-prompt', version: 1 }),
 *     ),
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
  /** @deprecated Langfuse v5 only supports linking by name + version. This field is ignored. */
  id?: string;
}

/**
 * Adds Langfuse prompt metadata to the tracing options
 * to enable Langfuse Prompt Tracing.
 *
 * The metadata is added under `metadata.langfuse.prompt` and includes:
 * - `name` - Prompt name (required for Langfuse v5)
 * - `version` - Prompt version (required for Langfuse v5)
 *
 * All fields are deeply merged with any existing metadata.
 *
 * @param prompt - Prompt fields for linking (`name` and `version` required)
 * @returns A TracingOptionsUpdater function for use with `buildTracingOptions`
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangfusePrompt } from '@mastra/langfuse';
 *
 * // Link a generation to a Langfuse prompt by name and version
 * const tracingOptions = buildTracingOptions(
 *   withLangfusePrompt({ name: 'customer-support', version: 1 }),
 * );
 *
 * // Or directly in agent config
 * const agent = new Agent({
 *   name: 'support-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4o'),
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(
 *       withLangfusePrompt({ name: 'my-prompt', version: 1 }),
 *     ),
 *   },
 * });
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
