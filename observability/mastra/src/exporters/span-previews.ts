import { coreFeatures } from '@mastra/core/features';
import type { AnyExportedSpan } from '@mastra/core/observability';
import * as coreObservability from '@mastra/core/observability';

const buildSpanPreviews = coreObservability.buildSpanPreviews as typeof coreObservability.buildSpanPreviews | undefined;

/** Older core versions retain their existing storage preview fallback. */
export function withSpanPreviews(span: AnyExportedSpan): AnyExportedSpan {
  if (!coreFeatures.has('observability-span-previews')) return span;

  try {
    const previews = buildSpanPreviews?.(span);
    return previews ? { ...span, ...previews } : span;
  } catch {
    // A formatter failure must not prevent telemetry delivery.
    return span;
  }
}
