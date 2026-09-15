import { estimateTokenCount } from 'tokenx';

import { safeSlice } from './string-utils';

const DEFAULT_OBSERVER_TOOL_ARGUMENT_MAX_TOKENS = 2_000;
const OBSERVER_TOOL_ARGUMENT_PREVIEW_MAX_TOKENS = 500;
const OBSERVER_TOOL_ARGUMENT_INLINE_STRING_MAX_CHARS = 160;
const OBSERVER_TOOL_ARGUMENT_MAX_DEPTH = 5;
const OBSERVER_TOOL_ARGUMENT_MAX_ENTRIES_PER_CONTAINER = 20;
const OBSERVER_TOOL_ARGUMENT_MAX_OUTLINE_ENTRIES = 100;
const OBSERVER_TOOL_ARGUMENT_MAX_PATH_CHARS = 160;

type PendingContainer = {
  path: string;
  value: Record<string, unknown> | unknown[];
  depth: number;
  ancestors: Set<object>;
};

type OutlineEntry = {
  text: string;
  depth: number;
  order: number;
};

type StringPreview = {
  path: string;
  value: string;
};

type RenderLimits = {
  maxTokens: number;
  maxCharacters: number;
};

type ReadEntry = {
  key: string | number;
  value?: unknown;
  unavailable?: 'hole' | 'unreadable';
};

type ReadEntriesResult = {
  entries: ReadEntry[];
  hasMore: boolean;
  unavailable: boolean;
};

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function sanitizeSurrogates(value: string): string {
  let sanitized = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        sanitized += value.charAt(index) + value.charAt(index + 1);
        index++;
      } else {
        sanitized += '�';
      }
      continue;
    }
    sanitized += code >= 0xdc00 && code <= 0xdfff ? '�' : value[index];
  }
  return sanitized;
}

function stablePathDigest(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function safeTail(value: string, length: number): string {
  let start = Math.max(0, value.length - length);
  if (start > 0) {
    const code = value.charCodeAt(start);
    if (code >= 0xdc00 && code <= 0xdfff) {
      start++;
    }
  }
  return value.slice(start);
}

function truncatePath(path: string): string {
  if (path.length <= OBSERVER_TOOL_ARGUMENT_MAX_PATH_CHARS) {
    return path;
  }
  const headLength = 50;
  const tailLength = 60;
  const omitted = path.length - headLength - tailLength;
  return `${safeSlice(path, headLength)}…[${omitted} chars; ${stablePathDigest(path)}]…${safeTail(path, tailLength)}`;
}

function formatPath(parent: string, key: string | number, isArray: boolean): string {
  if (isArray) {
    return truncatePath(`${parent}[${key}]`);
  }
  const stringKey = String(key);
  const segment = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stringKey) ? stringKey : `[${JSON.stringify(stringKey)}]`;
  return truncatePath(parent ? `${parent}.${segment}` : segment);
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return `<bigint> ${value}`;
  }
  if (typeof value === 'symbol' || typeof value === 'function') {
    return JSON.stringify(String(value));
  }
  if (value === undefined) {
    return '<undefined>';
  }
  if (typeof value === 'number' && Object.is(value, -0)) {
    return '-0';
  }
  return String(value);
}

function containerSummary(value: Record<string, unknown> | unknown[]): string {
  if (!Array.isArray(value)) {
    return '<object>';
  }
  try {
    return `<array, ${value.length} ${value.length === 1 ? 'item' : 'items'}>`;
  } catch {
    return '<array, unknown length>';
  }
}

function readEntries(value: Record<string, unknown> | unknown[]): ReadEntriesResult {
  const entries: ReadEntry[] = [];
  try {
    if (Array.isArray(value)) {
      const length = value.length;
      const visibleLength = Math.min(length, OBSERVER_TOOL_ARGUMENT_MAX_ENTRIES_PER_CONTAINER);
      for (let index = 0; index < visibleLength; index++) {
        if (!(index in value)) {
          entries.push({ key: index, unavailable: 'hole' });
          continue;
        }
        try {
          entries.push({ key: index, value: value[index] });
        } catch {
          entries.push({ key: index, unavailable: 'unreadable' });
        }
      }
      return { entries, hasMore: length > visibleLength, unavailable: false };
    }

    let hasMore = false;
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        continue;
      }
      if (entries.length >= OBSERVER_TOOL_ARGUMENT_MAX_ENTRIES_PER_CONTAINER) {
        hasMore = true;
        break;
      }
      try {
        entries.push({ key, value: value[key] });
      } catch {
        entries.push({ key, unavailable: 'unreadable' });
      }
    }
    return { entries, hasMore, unavailable: false };
  } catch {
    return { entries, hasMore: false, unavailable: true };
  }
}

function fits(text: string, limits: RenderLimits): boolean {
  return text.length <= limits.maxCharacters && estimateTokenCount(text) <= limits.maxTokens;
}

function joinEntries(entries: OutlineEntry[], marker?: string): string {
  const lines = [...entries].sort((a, b) => a.order - b.order).map(entry => entry.text);
  if (marker) {
    lines.push(marker);
  }
  return lines.join('\n');
}

function selectOutlineEntries(entries: OutlineEntry[], limits: RenderLimits): string {
  const all = joinEntries(entries);
  if (fits(all, limits)) {
    return all;
  }

  const marker = '... [additional argument fields omitted by size limit]';
  const selected: OutlineEntry[] = [];
  const candidates = [...entries].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    const tokenDelta = estimateTokenCount(a.text) - estimateTokenCount(b.text);
    return tokenDelta || a.text.length - b.text.length || a.order - b.order;
  });

  for (const candidate of candidates) {
    const proposed = joinEntries([...selected, candidate], marker);
    if (fits(proposed, limits)) {
      selected.push(candidate);
    }
  }

  const rendered = joinEntries(selected, marker);
  if (fits(rendered, limits)) {
    return rendered;
  }
  if (fits(marker, limits)) {
    return marker;
  }
  return fits('…', limits) ? '…' : '';
}

function indentPreview(value: string): string {
  return value
    .split('\n')
    .map(line => `  | ${line}`)
    .join('\n');
}

function formatPreview(path: string, value: string, limits: RenderLimits): string {
  const sanitizedValue = sanitizeSurrogates(value);
  const marker = (visible: string) => {
    const omitted = sanitizedValue.length - visible.length;
    const body = indentPreview(visible);
    return `${path}:\n${body}${omitted > 0 ? `\n  | ... [${omitted} characters omitted]` : ''}`;
  };

  let low = 0;
  let high = sanitizedValue.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const visible = safeSlice(sanitizedValue, mid);
    const candidate = marker(visible);
    if (fits(candidate, limits)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function appendWithinBudget(base: string, addition: string, limits: RenderLimits): string | undefined {
  if (!addition) {
    return undefined;
  }
  const candidate = base ? `${base}\n${addition}` : addition;
  return fits(candidate, limits) ? candidate : undefined;
}

/**
 * Formats tool arguments for the Observer without allowing a large early value
 * to hide concise sibling fields. A breadth-first structural outline is selected
 * before bounded previews of large strings are added.
 */
export function formatToolArgumentsForObserver(
  value: unknown,
  options?: {
    maxTokens?: number;
    maxCharacters?: number;
  },
): string {
  const limits: RenderLimits = {
    maxTokens: options?.maxTokens ?? DEFAULT_OBSERVER_TOOL_ARGUMENT_MAX_TOKENS,
    maxCharacters: options?.maxCharacters ?? Number.POSITIVE_INFINITY,
  };
  if (limits.maxTokens <= 0 || limits.maxCharacters <= 0) {
    return '';
  }

  if (!isObjectLike(value)) {
    if (typeof value !== 'string' || value.length <= OBSERVER_TOOL_ARGUMENT_INLINE_STRING_MAX_CHARS) {
      const primitive = formatPrimitive(value);
      return fits(primitive, limits) ? primitive : fits('…', limits) ? '…' : '';
    }
    const summary = `<string, ${value.length} characters; preview size-limited>`;
    const previewLimits = {
      maxTokens: Math.min(limits.maxTokens, OBSERVER_TOOL_ARGUMENT_PREVIEW_MAX_TOKENS),
      maxCharacters: limits.maxCharacters,
    };
    const preview = formatPreview('preview', value, previewLimits);
    const rendered = appendWithinBudget(summary, preview, limits);
    if (rendered) {
      return rendered;
    }
    if (fits(summary, limits)) {
      return summary;
    }
    return fits('…', limits) ? '…' : '';
  }

  const outline: OutlineEntry[] = [];
  const previews: StringPreview[] = [];
  const pending: PendingContainer[] = [{ path: '', value, depth: 0, ancestors: new Set([value]) }];
  let outlineEntries = 0;
  let order = 0;
  let structuralLimitReached = false;

  while (pending.length > 0 && outlineEntries < OBSERVER_TOOL_ARGUMENT_MAX_OUTLINE_ENTRIES) {
    const current = pending.shift()!;
    const read = readEntries(current.value);
    if (read.unavailable) {
      outline.push({
        text: `${current.path || 'arguments'}: [unavailable container]`,
        depth: current.depth,
        order: order++,
      });
      outlineEntries++;
      continue;
    }
    if (read.entries.length === 0 && !read.hasMore) {
      outline.push({
        text: `${current.path || 'arguments'}: [empty ${Array.isArray(current.value) ? 'array' : 'object'}]`,
        depth: current.depth,
        order: order++,
      });
      outlineEntries++;
      continue;
    }
    if (read.hasMore) {
      outline.push({
        text: `${current.path || (Array.isArray(current.value) ? 'items' : 'fields')}: ... [additional entries omitted]`,
        depth: current.depth,
        order: order++,
      });
      outlineEntries++;
    }

    for (const entry of read.entries) {
      if (outlineEntries >= OBSERVER_TOOL_ARGUMENT_MAX_OUTLINE_ENTRIES) {
        structuralLimitReached = true;
        break;
      }
      const path = formatPath(current.path, entry.key, Array.isArray(current.value));
      outlineEntries++;
      if (entry.unavailable) {
        outline.push({ text: `${path}: [${entry.unavailable}]`, depth: current.depth, order: order++ });
        continue;
      }

      const entryValue = entry.value;
      if (typeof entryValue === 'string' && entryValue.length > OBSERVER_TOOL_ARGUMENT_INLINE_STRING_MAX_CHARS) {
        outline.push({
          text: `${path}: <string, ${entryValue.length} characters; preview size-limited>`,
          depth: current.depth,
          order: order++,
        });
        previews.push({ path, value: entryValue });
        continue;
      }
      if (!isObjectLike(entryValue)) {
        outline.push({ text: `${path}: ${formatPrimitive(entryValue)}`, depth: current.depth, order: order++ });
        continue;
      }
      if (current.ancestors.has(entryValue)) {
        outline.push({ text: `${path}: [circular]`, depth: current.depth, order: order++ });
        continue;
      }

      const summary = containerSummary(entryValue);
      if (current.depth >= OBSERVER_TOOL_ARGUMENT_MAX_DEPTH) {
        outline.push({ text: `${path}: ${summary} [max depth reached]`, depth: current.depth, order: order++ });
        continue;
      }

      outline.push({ text: `${path}: ${summary}`, depth: current.depth, order: order++ });
      pending.push({
        path,
        value: entryValue,
        depth: current.depth + 1,
        ancestors: new Set([...current.ancestors, entryValue]),
      });
    }
  }

  if (pending.length > 0 || structuralLimitReached) {
    outline.push({
      text: '... [additional nested entries omitted by structure limit]',
      depth: Number.POSITIVE_INFINITY,
      order: order++,
    });
  }

  if (previews.length === 0) {
    return selectOutlineEntries(outline, limits);
  }

  const previewHeader = 'Large string previews (size-limited):';
  const renderedOutline = selectOutlineEntries(outline, limits);
  const withPreviewHeader = appendWithinBudget(renderedOutline, previewHeader, limits);
  if (!withPreviewHeader) {
    return renderedOutline;
  }
  let rendered = withPreviewHeader;

  let renderedPreviews = 0;
  let omittedPreviews = 0;
  for (let index = 0; index < previews.length; index++) {
    const remainingCount = previews.length - index;
    const remainingTokens = Math.max(0, limits.maxTokens - estimateTokenCount(rendered));
    const remainingCharacters = Math.max(0, limits.maxCharacters - rendered.length - 1);
    const previewLimits: RenderLimits = {
      maxTokens: Math.min(OBSERVER_TOOL_ARGUMENT_PREVIEW_MAX_TOKENS, Math.floor(remainingTokens / remainingCount)),
      maxCharacters: Math.floor(remainingCharacters / remainingCount),
    };
    const preview = formatPreview(previews[index]!.path, previews[index]!.value, previewLimits);
    if (!preview) {
      omittedPreviews++;
      continue;
    }
    const withPreview = appendWithinBudget(rendered, preview, limits);
    if (!withPreview) {
      omittedPreviews++;
      continue;
    }
    rendered = withPreview;
    renderedPreviews++;
  }

  if (renderedPreviews === 0) {
    return renderedOutline;
  }

  if (omittedPreviews > 0) {
    const marker = `... [${omittedPreviews} large string ${omittedPreviews === 1 ? 'preview' : 'previews'} omitted]`;
    rendered = appendWithinBudget(rendered, marker, limits) ?? rendered;
  }

  return rendered;
}
