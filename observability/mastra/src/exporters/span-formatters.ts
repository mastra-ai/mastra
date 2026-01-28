/**
 * Utility functions for working with custom span formatters.
 */

import type { AnyExportedSpan, CustomSpanFormatter } from '@mastra/core/observability';

/**
 * Chains multiple span formatters into a single formatter.
 *
 * Formatters are applied in order, with each receiving the output of the previous.
 * Supports both synchronous and asynchronous formatters - if any formatter returns
 * a Promise, the entire chain will return a Promise.
 *
 * @param formatters - Array of formatters to chain (can be sync or async)
 * @returns A single formatter that applies all formatters in sequence
 *
 * @example
 * ```typescript
 * // Chain sync formatters
 * const chainedFormatter = chainFormatters([
 *   myPlainTextFormatter,
 *   myRedactionFormatter,
 * ]);
 *
 * // Chain mixed sync and async formatters
 * const asyncChainedFormatter = chainFormatters([
 *   myPlainTextFormatter,     // sync
 *   myAsyncEnrichmentFormatter, // async
 * ]);
 *
 * const exporter = new BraintrustExporter({
 *   customSpanFormatter: chainedFormatter,
 * });
 * ```
 */
export function chainFormatters(formatters: CustomSpanFormatter[]): CustomSpanFormatter {
  return async (span: AnyExportedSpan): Promise<AnyExportedSpan> => {
    let currentSpan = span;
    for (const formatter of formatters) {
      currentSpan = await formatter(currentSpan);
    }
    return currentSpan;
  };
}
