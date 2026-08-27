import type { TimelineSpan } from './build-thread-timeline';

/** Past this, shiki tokenising the payload costs more than the colors are worth (decision 5). */
export const HIGHLIGHT_LIMIT = 20_000;
/** Past this, the payload is cut: no one reads 200k of JSON in a timeline row. */
export const TRUNCATE_LIMIT = 200_000;

/**
 * Attributes the row already states in plain words, so repeating them in the raw
 * dump would only add noise (decision 3). `tools` and `messageListMutations` are
 * deliberately absent: the row shows a count, not the content.
 */
const RENDERED_ATTRIBUTES = new Set(['model', 'provider', 'usage', 'costContext', 'status', 'success']);

export type SpanPayloadSection = {
  label: string;
  json: string;
  /** False once the payload is too big to syntax highlight; `Code` then falls back to plain text. */
  highlight: boolean;
};

/** Never throws: an unserialisable payload is dropped rather than rendered broken. */
function stringify(value: unknown): string | undefined {
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json || json === '{}' || json === '[]') return undefined;
    return json;
  } catch {
    return undefined;
  }
}

function toSection(label: string, value: unknown): SpanPayloadSection | undefined {
  if (value === null || value === undefined) return undefined;

  const json = stringify(value);
  if (!json) return undefined;

  return json.length > TRUNCATE_LIMIT
    ? { label, json: `${json.slice(0, TRUNCATE_LIMIT)}\n\n… truncated`, highlight: false }
    : { label, json, highlight: json.length <= HIGHLIGHT_LIMIT };
}

/** Everything on the span the row does not already say, ready to drop into a code block. */
export function spanPayloadSections(span: TimelineSpan): SpanPayloadSection[] {
  const attributes = Object.fromEntries(
    Object.entries(span.attributes ?? {}).filter(
      ([key, value]) => !RENDERED_ATTRIBUTES.has(key) && value !== undefined,
    ),
  );

  return [toSection('Input', span.input), toSection('Output', span.output), toSection('Metadata', attributes)].filter(
    (section): section is SpanPayloadSection => Boolean(section),
  );
}
