/**
 * OpenAI's `webSearch` declares an empty input schema — the query never reaches us as
 * tool args, it comes back in the result as an `action`. Anthropic's `webSearch_20250305`
 * does send a `query` input and answers with a bare array of results.
 */

export type WebSearchAction =
  | { type: 'search'; query?: string }
  | { type: 'openPage'; url?: string }
  | { type: 'findInPage'; url?: string; pattern?: string };

export interface WebSearchLink {
  url: string;
  title?: string;
}

export function isWebSearchTool(toolName: string): boolean {
  return toolName === 'web_search';
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
 * large `encryptedContent` blob, dropped here rather than dumped into the card.
 */
export function webSearchLinks(result: unknown): WebSearchLink[] {
  const links = resultEntries(result).flatMap(entry => {
    const url = stringField(entry, 'url');
    return url ? [{ url, title: stringField(entry, 'title') }] : [];
  });
  if (links.length > 0) return links;

  const action = webSearchAction(result);
  const url = action && 'url' in action ? action.url : undefined;
  return url ? [{ url }] : [];
}
