/**
 * Utility functions for working with custom span formatters.
 */

import type { AnyExportedSpan, CustomSpanFormatter } from '@mastra/core/observability';

/**
 * Chains multiple span formatters into a single formatter.
 *
 * Formatters are applied in order, with each receiving the output of the previous.
 *
 * @param formatters - Array of formatters to chain
 * @returns A single formatter that applies all formatters in sequence
 *
 * @example
 * ```typescript
 * const chainedFormatter = chainFormatters([
 *   myPlainTextFormatter,
 *   myRedactionFormatter,
 * ]);
 *
 * const exporter = new BraintrustExporter({
 *   customSpanFormatter: chainedFormatter,
 * });
 * ```
 */
export function chainFormatters(formatters: CustomSpanFormatter[]): CustomSpanFormatter {
  return (span: AnyExportedSpan): AnyExportedSpan => {
    return formatters.reduce((currentSpan, formatter) => formatter(currentSpan), span);
  };
}
