export type DataCodeSectionRenderMode = 'json' | 'markdown' | 'text';

export interface DataCodeSectionPayload {
  mode: DataCodeSectionRenderMode;
  value: string;
  copyValue: string;
  hasMultilineText: boolean;
}

interface ResolvePayloadArgs {
  data?: unknown;
  codeStr?: string;
}

export function resolveDataCodeSectionPayload({ data, codeStr = '' }: ResolvePayloadArgs): DataCodeSectionPayload | null {
  const source = data !== undefined ? data : parseCodeString(codeStr);

  if (source == null) return null;

  if (typeof source === 'string') {
    return resolveStringPayload(source);
  }

  const value = stringifyJson(source);

  if (!value || value === 'null') return null;

  return {
    mode: 'json',
    value,
    copyValue: value,
    hasMultilineText: containsInnerNewline(source),
  };
}

export function containsInnerNewline(obj: unknown): boolean {
  if (typeof obj === 'string') {
    const idx = obj.indexOf('\n');
    return idx !== -1 && idx !== obj.length - 1;
  } else if (Array.isArray(obj)) {
    return obj.some(item => containsInnerNewline(item));
  } else if (obj && typeof obj === 'object') {
    return Object.values(obj).some(value => containsInnerNewline(value));
  }
  return false;
}

function resolveStringPayload(source: string): DataCodeSectionPayload | null {
  const embeddedJson = parseEmbeddedJson(source);

  if (embeddedJson !== undefined) {
    const value = stringifyJson(embeddedJson);

    return {
      mode: 'json',
      value,
      copyValue: value,
      hasMultilineText: containsInnerNewline(embeddedJson),
    };
  }

  const value = normalizeEscapedNewlines(source);

  return {
    mode: looksLikeMarkdown(value) ? 'markdown' : 'text',
    value,
    copyValue: value,
    hasMultilineText: false,
  };
}

function parseCodeString(codeStr: string): unknown {
  if (!codeStr || codeStr === 'null') return null;

  try {
    return JSON.parse(codeStr);
  } catch {
    return codeStr;
  }
}

function parseEmbeddedJson(source: string): unknown | undefined {
  const trimmed = source.trim();

  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function stringifyJson(value: unknown): string {
  try {
    const stringified = JSON.stringify(value, null, 2);
    return stringified ?? String(value);
  } catch {
    return String(value);
  }
}

function normalizeEscapedNewlines(source: string): string {
  return source.replace(/\\n/g, '\n');
}

function looksLikeMarkdown(source: string): boolean {
  return [
    /^#{1,6}\s/m,
    /^[-*+]\s/m,
    /^\d+\.\s/m,
    /^>\s/m,
    /```/,
    /\*\*[^*]+\*\*/,
    /__[^_]+__/,
    /`[^`]+`/,
    /\[[^\]]+\]\([^)]+\)/,
    /\n\|.+\|\n\|[-:|\s]+\|/,
  ].some(pattern => pattern.test(source));
}
