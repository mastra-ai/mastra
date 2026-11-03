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
// \uE200<family>(\uE202<id>)+\uE201, e.g. family `cite` with ids like `turn0search0`.
const CITATION_MARKER_RE = /\uE200[\w-]+(?:\uE202[\w-]+)+\uE201/g;
// A tail that could still grow into a complete marker.
const PARTIAL_CITATION_MARKER_RE = /^\uE200[\w-]*(?:\uE202[\w-]*)*$/;

// The same grammar inside serialized JSON, where each marker character may
// also appear as a `\uE2xx` escape.
const JSON_START = String.raw`(?:\uE200|\\u[eE]200)`;
const JSON_SEP = String.raw`(?:\uE202|\\u[eE]202)`;
const JSON_END = String.raw`(?:\uE201|\\u[eE]201)`;
// A backslash that may still grow into one of the escapes above.
const JSON_PARTIAL_ESCAPE = String.raw`\\(?:u(?:[eE](?:2(?:0)?)?)?)?`;
const JSON_CITATION_MARKER_RE = new RegExp(`${JSON_START}[\\w-]+(?:${JSON_SEP}[\\w-]+)+${JSON_END}`, 'g');
const JSON_PARTIAL_CITATION_MARKER_RE = new RegExp(
  `^(?:${JSON_PARTIAL_ESCAPE}|${JSON_START}[\\w-]*(?:${JSON_SEP}[\\w-]*)*(?:${JSON_PARTIAL_ESCAPE})?)$`,
);
const ESCAPED_CITATION_START_RE = /\\u[eE]200/;

export function stripCitationMarkup(text: string): string {
  return text.includes(CITATION_START) ? text.replace(CITATION_MARKER_RE, '') : text;
}

function stripCitationMarkupFromJson(json: string): string {
  return json.includes(CITATION_START) || ESCAPED_CITATION_START_RE.test(json)
    ? json.replace(JSON_CITATION_MARKER_RE, '')
    : json;
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
    return stripCitationMarkupFromJson(input);
  }
  const cleaned = stripCitationMarkupDeep(parsed);
  return JSON.stringify(cleaned) === JSON.stringify(parsed) ? input : JSON.stringify(cleaned);
}

/**
 * Removes citation markers from a stream of deltas. A marker can be split
 * across deltas, so a trailing partial marker is held back until it closes,
 * stops looking like a marker, or is flushed. With `json: true` (streamed
 * tool-call input) markers written as JSON escapes are removed as well.
 */
export class CitationMarkupStreamSanitizer {
  #pending = new Map<string, string>();
  readonly #json: boolean;

  constructor({ json = false }: { json?: boolean } = {}) {
    this.#json = json;
  }

  push(id: string, delta: string): string {
    const pending = this.#pending.get(id);
    if (pending === undefined && !this.#mayContainMarker(delta)) return delta;

    const joined = (pending ?? '') + delta;
    const text = this.#json ? stripCitationMarkupFromJson(joined) : stripCitationMarkup(joined);
    const start = this.#partialMarkerStart(text);
    if (start === -1) {
      this.#pending.delete(id);
      return text;
    }
    this.#pending.set(id, text.slice(start));
    return text.slice(0, start);
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

  #mayContainMarker(delta: string): boolean {
    return delta.includes(CITATION_START) || (this.#json && delta.includes('\\'));
  }

  /**
   * Index where a trailing, still-growable marker begins, or -1. Marker text
   * only contains word characters, `-`, marker characters and (in JSON)
   * backslashes, so the search is limited to the trailing run of those.
   */
  #partialMarkerStart(text: string): number {
    const partialRe = this.#json ? JSON_PARTIAL_CITATION_MARKER_RE : PARTIAL_CITATION_MARKER_RE;
    let runStart = text.length;
    while (runStart > 0 && /[\w\-\uE200\uE202\\]/.test(text[runStart - 1]!)) runStart--;
    for (let i = runStart; i < text.length; i++) {
      const ch = text[i];
      if ((ch === CITATION_START || (this.#json && ch === '\\')) && partialRe.test(text.slice(i))) return i;
    }
    return -1;
  }
}
