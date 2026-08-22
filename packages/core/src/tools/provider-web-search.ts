// OpenAI's web search declares an empty input and reports the call it made in the result `action`;
// Anthropic's takes a `query` and answers with a bare array of results.

/** `type` stays whatever the provider named the action, so a kind added later still arrives with its target. */
export interface WebSearchAction {
  type: string;
  query?: string;
  queries?: string[];
  url?: string;
  pattern?: string;
}

export interface WebSearchLink {
  url: string;
  title?: string;
  pageAge?: string;
}

/** Providers suffix their own tool name: `web_search_20250305`, `web_search_preview`. */
export function isWebSearchToolName(toolName: string): boolean {
  return /^web_search(?:_\w+)?$/.test(toolName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function stringListField(value: unknown, key: string): string[] | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  if (!Array.isArray(field)) return undefined;
  const items = field.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return items.length > 0 ? items : undefined;
}

export function webSearchAction(result: unknown): WebSearchAction | undefined {
  if (!isRecord(result)) return undefined;
  const action = result.action;
  const type = stringField(action, 'type');
  if (!type) return undefined;
  return {
    type,
    query: stringField(action, 'query'),
    queries: stringListField(action, 'queries'),
    url: stringField(action, 'url'),
    pattern: stringField(action, 'pattern'),
  };
}

export function webSearchTarget(action: WebSearchAction): string | undefined {
  return action.query ?? action.queries?.join(', ') ?? action.pattern ?? action.url;
}

function resultEntries(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (isRecord(result) && Array.isArray(result.sources)) return result.sources;
  return [];
}

/** Anthropic entries also carry a large `encryptedContent` blob, dropped here. */
export function webSearchLinks(result: unknown): WebSearchLink[] {
  const links = resultEntries(result).flatMap(entry => {
    const url = stringField(entry, 'url');
    if (!url) return [];
    return [{ url, title: stringField(entry, 'title'), pageAge: stringField(entry, 'pageAge') }];
  });
  if (links.length > 0) return links;

  const url = webSearchAction(result)?.url;
  return url ? [{ url }] : [];
}
