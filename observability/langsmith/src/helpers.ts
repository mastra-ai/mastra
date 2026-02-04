/**
 * LangSmith Tracing Options Helpers
 *
 * These helpers integrate with the `buildTracingOptions` pattern from
 * `@mastra/observability` to add LangSmith-specific tracing features.
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangsmithMetadata } from '@mastra/langsmith';
 *
 * const agent = new Agent({
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(
 *       withLangsmithMetadata({ projectName: 'my-project' })
 *     ),
 *   },
 * });
 * ```
 */

import type { TracingOptionsUpdater } from '@mastra/observability';

/**
 * LangSmith vendor metadata that can be passed via span metadata.
 * These fields are extracted by the LangSmith exporter and used
 * to override default configuration on a per-span basis.
 */
export interface LangSmithMetadataInput {
  /**
   * Override the project name for this span and its children.
   * This allows dynamically routing traces to different LangSmith projects.
   */
  projectName?: string;
  /**
   * Additional tags to add to this span in LangSmith.
   */
  tags?: string[];
  /**
   * Session ID for grouping related traces in LangSmith.
   */
  sessionId?: string;
  /**
   * Session name for display in LangSmith.
   */
  sessionName?: string;
}

/**
 * Adds LangSmith metadata to the tracing options.
 *
 * The metadata is added under `metadata.langsmith` and allows you to:
 * - Route traces to different LangSmith projects via `projectName`
 * - Add tags to spans via `tags`
 * - Group traces by session via `sessionId` and `sessionName`
 *
 * @param metadata - The LangSmith metadata to add
 * @returns A TracingOptionsUpdater function for use with `buildTracingOptions`
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangsmithMetadata } from '@mastra/langsmith';
 *
 * // Route traces to a specific project
 * const tracingOptions = buildTracingOptions(
 *   withLangsmithMetadata({ projectName: 'customer-support' }),
 * );
 *
 * // Or set multiple fields
 * const tracingOptions = buildTracingOptions(
 *   withLangsmithMetadata({
 *     projectName: 'my-project',
 *     tags: ['production', 'customer-facing'],
 *     sessionId: 'session-123',
 *   }),
 * );
 *
 * // Use in agent config
 * const agent = new Agent({
 *   name: 'support-agent',
 *   model: openai('gpt-4o'),
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(
 *       withLangsmithMetadata({ projectName: 'support-traces' })
 *     ),
 *   },
 * });
 * ```
 */
export function withLangsmithMetadata(metadata: LangSmithMetadataInput): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    metadata: {
      ...opts.metadata,
      langsmith: {
        ...(opts.metadata?.langsmith as Record<string, unknown>),
        ...metadata,
      },
    },
  });
}
