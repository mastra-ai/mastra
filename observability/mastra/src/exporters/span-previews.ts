import type { AnyExportedSpan } from '@mastra/core/observability';
import * as coreStorage from '@mastra/core/storage';

// Namespace lookups keep native ESM and bundled exports loadable with older core.
// Do not import core/features here: older peers may lack that subpath entirely.
const buildSpanPreviews: typeof coreStorage.buildSpanPreviews | undefined = Reflect.get(
  coreStorage,
  'buildSpanPreviews',
);
const buildPreview: typeof coreStorage.buildPreview | undefined = Reflect.get(coreStorage, 'buildPreview');

/** Prefer core's span-aware formatter, then its generic formatter, then passthrough. */
export function withSpanPreviews(span: AnyExportedSpan): AnyExportedSpan {
  if (typeof buildSpanPreviews === 'function') {
    try {
      return { ...span, ...buildSpanPreviews(span) };
    } catch {
      // A formatter failure must not prevent telemetry delivery.
    }
  }
  if (typeof buildPreview !== 'function') return span;
  const preview = (field: 'input' | 'output' | 'error'): string => {
    try {
      const upstream = span[`${field}Preview`];
      if (typeof upstream === 'string') return buildPreview(upstream) ?? '';
      // Older generic formatters serialize unknown objects. Never feed them an
      // entire error: only use safe display fields, excluding stack and details.
      const value =
        field === 'error'
          ? typeof span.errorInfo === 'string'
            ? span.errorInfo
            : typeof span.errorInfo?.message === 'string'
              ? span.errorInfo.message
              : typeof span.errorInfo?.name === 'string'
                ? span.errorInfo.name
                : undefined
          : span[field];
      return buildPreview(value) ?? '';
    } catch {
      return '';
    }
  };
  return { ...span, inputPreview: preview('input'), outputPreview: preview('output'), errorPreview: preview('error') };
}
