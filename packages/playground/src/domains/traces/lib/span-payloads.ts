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

/** A key-value line is a summary, not a payload: past this it stops being scannable. */
export const MAX_VALUE_LENGTH = 200;

export type SpanPayloadEntry = {
  key: string;
  value: string;
};

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

/** Never throws: a key whose value will not serialise is dropped rather than rendered broken. */
function formatValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * The first-level keys of a payload as a flat list. Nested values are collapsed to one
 * line of JSON and cut short: this is a readout, and the full payload stays one click
 * away in the full trace view.
 */
export function spanPayloadEntries(value: unknown): SpanPayloadEntry[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];

  const entries: SpanPayloadEntry[] = [];

  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;

    const formatted = formatValue(raw);
    if (formatted === undefined) continue;

    entries.push({
      key,
      value: formatted.length > MAX_VALUE_LENGTH ? `${formatted.slice(0, MAX_VALUE_LENGTH)}…` : formatted,
    });
  }

  return entries;
}

/** Everything on the span the row does not already say, ready to drop into a code block. */
export function spanPayloadSections(span: TimelineSpan): SpanPayloadSection[] {
  // A processor's input is the message list the row above already describes and its
  // metadata is runner bookkeeping, so only what the processor produced is worth showing.
  if (span.spanType === 'processor_run') {
    return [toSection('Output', span.output)].filter((section): section is SpanPayloadSection => Boolean(section));
  }

  const attributes = Object.fromEntries(
    Object.entries(span.attributes ?? {}).filter(
      ([key, value]) => !RENDERED_ATTRIBUTES.has(key) && value !== undefined,
    ),
  );

  return [toSection('Input', span.input), toSection('Output', span.output), toSection('Metadata', attributes)].filter(
    (section): section is SpanPayloadSection => Boolean(section),
  );
}
