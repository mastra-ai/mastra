/**
 * OpenAI models (notably with the built-in `web_search` / `file_search` tools)
 * can write their internal citation markup into response text and tool-call
 * arguments, e.g. `\uE200cite\uE202turn0search0\uE202turn0search1\uE201`.
 * OpenAI's citation-formatting guide expects clients to parse and strip these
 * markers; the actual citation data arrives separately as structured
 * annotations (surfaced as `source` chunks). Left in place they render as
 * garbage like `citeturn0search0` in UIs, persisted messages and tool args.
 *
 * Only complete, well-formed markers are removed, so other private-use
 * characters (e.g. icon-font glyphs) pass through untouched.
 */
const CITATION_START = '\uE200';
// \uE200<family>(\uE202<id>)*\uE201, e.g. family `cite` with ids like `turn0search0`.
const CITATION_MARKER_RE = /\uE200[\w-]+(?:\uE202[\w-]+)*\uE201/g;
// A tail that could still grow into a complete marker.
const PARTIAL_CITATION_MARKER_RE = /^\uE200[\w-]*(?:\uE202[\w-]*)*$/;
const ESCAPED_CITATION_START_RE = /\\u[eE]200/;

/**
 * How far past an unclosed marker start the streaming sanitizer holds text
 * back while waiting for the marker to close. Real markers are far shorter.
 */
const MAX_PENDING_MARKER_LENGTH = 256;

export function stripCitationMarkup(text: string): string {
  return text.includes(CITATION_START) ? text.replace(CITATION_MARKER_RE, '') : text;
}

function stripCitationMarkupDeep(value: unknown): unknown {
  if (typeof value === 'string') return stripCitationMarkup(value);
  if (Array.isArray(value)) return value.map(stripCitationMarkupDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stripCitationMarkupDeep(entry)]));
  }
  return value;
}

/**
 * Strips citation markers from a serialized tool-call input. The markers may
 * appear as raw characters or as `\uE200`-style JSON escapes, so the input is
 * parsed and every string value is cleaned; it is only re-serialized when
 * something was removed.
 */
export function stripCitationMarkupFromToolInput(input: string): string {
  if (!input.includes(CITATION_START) && !ESCAPED_CITATION_START_RE.test(input)) return input;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return stripCitationMarkup(input);
  }
  const cleaned = stripCitationMarkupDeep(parsed);
  return JSON.stringify(cleaned) === JSON.stringify(parsed) ? input : JSON.stringify(cleaned);
}

/**
 * Removes citation markers from a stream of text deltas. A marker can be split
 * across deltas, so a trailing partial marker is held back until it closes,
 * stops looking like a marker, or is flushed.
 */
export class CitationMarkupStreamSanitizer {
  #pending = new Map<string, string>();

  push(id: string, delta: string): string {
    const pending = this.#pending.get(id);
    if (pending === undefined && !delta.includes(CITATION_START)) return delta;

    const text = stripCitationMarkup((pending ?? '') + delta);
    const start = text.lastIndexOf(CITATION_START);
    const tail = start === -1 ? '' : text.slice(start);
    if (tail && tail.length <= MAX_PENDING_MARKER_LENGTH && PARTIAL_CITATION_MARKER_RE.test(tail)) {
      this.#pending.set(id, tail);
      return text.slice(0, start);
    }
    this.#pending.delete(id);
    return text;
  }

  /** Releases any text held back for `id`. */
  flush(id: string): string {
    const pending = this.#pending.get(id);
    this.#pending.delete(id);
    return pending ?? '';
  }

  /** Releases held-back text for every id, in insertion order. */
  flushAll(): Array<[id: string, text: string]> {
    const entries = [...this.#pending.entries()];
    this.#pending.clear();
    return entries;
  }
}
