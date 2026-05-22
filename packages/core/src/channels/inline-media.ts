import type { IMastraLogger } from '../logger/logger';

const DEFAULT_INLINE_MEDIA_TYPES: string[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** A single entry in the `inlineLinks` config. */
export type InlineLinkEntry =
  | string // Domain pattern — HEAD determines mime type, checked against inlineMedia
  | { match: string; mimeType: string }; // Domain + forced mime type (skips HEAD & inlineMedia)

/** Resolved inline-link rule after normalisation. */
export interface InlineLinkRule {
  match: string;
  /** If set, skip HEAD and use this mime type directly. */
  forcedMimeType?: string;
}

/**
 * Build a predicate from the `inlineMedia` config option.
 * Supports glob patterns (e.g. `'image/*'`) and custom functions.
 * Default: see `DEFAULT_INLINE_MEDIA_TYPES`.
 */
export function buildInlineMediaCheck(
  config?: string[] | ((mimeType: string) => boolean),
): (mimeType: string) => boolean {
  if (typeof config === 'function') return config;
  const patterns = config ?? DEFAULT_INLINE_MEDIA_TYPES;
  return (mimeType: string) => {
    return patterns.some(pattern => {
      if (pattern === '*' || pattern === '*/*') return true;
      if (pattern.endsWith('/*')) {
        return mimeType.startsWith(pattern.slice(0, -1));
      }
      return mimeType === pattern;
    });
  };
}

/**
 * Normalise the `inlineLinks` config into a list of rules.
 * Returns `undefined` if the feature is disabled.
 */
export function normalizeInlineLinks(config?: InlineLinkEntry[]): InlineLinkRule[] | undefined {
  if (config == null || config.length === 0) return undefined;
  return config.map(entry =>
    typeof entry === 'string' ? { match: entry } : { match: entry.match, forcedMimeType: entry.mimeType },
  );
}

/** Check if a URL's hostname matches a domain pattern. @internal */
export function matchesDomain(url: string, pattern: string): boolean {
  if (pattern === '*') return true;
  try {
    const hostname = new URL(url).hostname;
    return hostname === pattern || hostname.endsWith(`.${pattern}`);
  } catch {
    return false;
  }
}

/** Find the first matching inline-link rule for a URL. */
export function findInlineLinkRule(url: string, rules: InlineLinkRule[]): InlineLinkRule | undefined {
  return rules.find(rule => matchesDomain(url, rule.match));
}

/** Extract URLs from plain text. @internal */
const URL_REGEX = /https?:\/\/[^\s<>)"']+/gi;
export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_REGEX), m => m[0]);
}

/**
 * HEAD a URL to determine its Content-Type.
 * Returns undefined if the request fails or has no Content-Type.
 */
export async function headContentType(url: string, logger?: IMastraLogger): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return undefined;
    const ct = res.headers.get('content-type');
    // Strip parameters (e.g. 'image/png; charset=utf-8' → 'image/png')
    return ct?.split(';')[0]?.trim() || undefined;
  } catch (e) {
    logger?.debug('[CHANNEL] HEAD request failed for link', { url, error: String(e) });
    return undefined;
  }
}
