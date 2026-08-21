/**
 * Reads a provider-executed web search, whose call is described by its result rather
 * than its input: OpenAI's `webSearch` declares an empty input schema and answers with
 * an `action`, while Anthropic's `webSearch_20250305` sends a `query` input and answers
 * with a bare array of results.
 */

export type WebSearchAction =
  | { type: 'search'; query?: string }
  | { type: 'openPage'; url?: string }
  | { type: 'findInPage'; url?: string; pattern?: string };

export interface WebSearchLink {
  url: string;
  title?: string;
  pageAge?: string;
}

/** Matches both the plain name and the dated one providers use (`web_search_20250305`). */
export function isWebSearchToolName(toolName: string): boolean {
  return toolName === 'web_search' || /^web_search_\d+$/.test(toolName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

export function webSearchAction(result: unknown): WebSearchAction | undefined {
  if (!isRecord(result)) return undefined;
  const action = result.action;
  switch (stringField(action, 'type')) {
    case 'search':
      return { type: 'search', query: stringField(action, 'query') };
    case 'openPage':
      return { type: 'openPage', url: stringField(action, 'url') };
    case 'findInPage':
      return { type: 'findInPage', url: stringField(action, 'url'), pattern: stringField(action, 'pattern') };
    default:
      return undefined;
  }
}

function resultEntries(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (isRecord(result) && Array.isArray(result.sources)) return result.sources;
  return [];
}

/**
 * Pages the call touched, whichever provider ran it. Anthropic entries also carry a
 * large `encryptedContent` blob, left out here rather than handed to a renderer.
 */
export function webSearchLinks(result: unknown): WebSearchLink[] {
  const links = resultEntries(result).flatMap(entry => {
    const url = stringField(entry, 'url');
    if (!url) return [];
    return [{ url, title: stringField(entry, 'title'), pageAge: stringField(entry, 'pageAge') }];
  });
  if (links.length > 0) return links;

  const action = webSearchAction(result);
  const url = action && 'url' in action ? action.url : undefined;
  return url ? [{ url }] : [];
}
