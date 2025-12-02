/**
 * Composable Tracing Options Builder
 *
 * This module provides a functional composition pattern for building
 * TracingOptions. Each observability provider can export "updater" functions
 * that can be composed together using `buildTracingOptions`.
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangfusePrompt } from '@mastra/langfuse';
 *
 * const prompt = await langfuse.getPrompt('my-prompt');
 *
 * const tracingOptions = buildTracingOptions(
 *   withLangfusePrompt(prompt),
 * );
 * ```
 */

import type { TracingOptions } from '@mastra/core/observability';

/**
 * A function that updates TracingOptions.
 * Used with `buildTracingOptions` to compose tracing configuration.
 *
 * @example
 * ```typescript
 * // Creating a custom updater
 * const withCustomMetadata: TracingOptionsUpdater = (opts) => ({
 *   ...opts,
 *   metadata: {
 *     ...opts.metadata,
 *     customField: 'value',
 *   },
 * });
 * ```
 */
export type TracingOptionsUpdater = (options: TracingOptions) => TracingOptions;

/**
 * Builds TracingOptions by composing one or more updater functions.
 *
 * This enables a clean, composable API for building tracing configuration
 * with features from multiple observability providers.
 *
 * @param updaters - One or more TracingOptionsUpdater functions to apply
 * @returns The composed TracingOptions object
 *
 * @example
 * ```typescript
 * import { buildTracingOptions } from '@mastra/observability';
 * import { withLangfusePrompt } from '@mastra/langfuse';
 *
 * // Single updater
 * const options = buildTracingOptions(
 *   withLangfusePrompt(prompt),
 * );
 *
 * // Multiple updaters (composed left to right)
 * const options = buildTracingOptions(
 *   withLangfusePrompt(prompt),
 *   withUserId('user-123'),
 *   withSessionId('session-456'),
 * );
 *
 * // Use with agent
 * const agent = new Agent({
 *   defaultGenerateOptions: {
 *     tracingOptions: buildTracingOptions(withLangfusePrompt(prompt)),
 *   },
 * });
 * ```
 */
export function buildTracingOptions(...updaters: TracingOptionsUpdater[]): TracingOptions {
  const initialOptions: TracingOptions = {};
  return updaters.reduce((opts, updater) => updater(opts), initialOptions);
}

/**
 * Creates a TracingOptionsUpdater that sets userId in metadata.
 *
 * @example
 * ```typescript
 * const options = buildTracingOptions(
 *   withUserId('user-123'),
 * );
 * ```
 */
export function withUserId(userId: string): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    metadata: {
      ...opts.metadata,
      userId,
    },
  });
}

/**
 * Creates a TracingOptionsUpdater that sets sessionId in metadata.
 *
 * @example
 * ```typescript
 * const options = buildTracingOptions(
 *   withSessionId('session-456'),
 * );
 * ```
 */
export function withSessionId(sessionId: string): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    metadata: {
      ...opts.metadata,
      sessionId,
    },
  });
}

/**
 * Creates a TracingOptionsUpdater that adds custom metadata fields.
 *
 * @example
 * ```typescript
 * const options = buildTracingOptions(
 *   withMetadata({ experimentId: 'exp-1', variant: 'A' }),
 * );
 * ```
 */
export function withMetadata(metadata: Record<string, unknown>): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    metadata: {
      ...opts.metadata,
      ...metadata,
    },
  });
}

/**
 * Creates a TracingOptionsUpdater that sets the trace ID.
 *
 * @example
 * ```typescript
 * const options = buildTracingOptions(
 *   withTraceId('abc123'),
 * );
 * ```
 */
export function withTraceId(traceId: string): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    traceId,
  });
}

/**
 * Creates a TracingOptionsUpdater that sets the parent span ID.
 *
 * @example
 * ```typescript
 * const options = buildTracingOptions(
 *   withParentSpanId('parent-123'),
 * );
 * ```
 */
export function withParentSpanId(parentSpanId: string): TracingOptionsUpdater {
  return opts => ({
    ...opts,
    parentSpanId,
  });
}
