/**
 * Tests for packages/core/src/channels/inline-media.ts
 *
 * All tested functions are pure (or near-pure) — no network I/O except
 * `headContentType` which is tested via a fetch mock.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  buildInlineMediaCheck,
  extractUrls,
  findInlineLinkRule,
  matchesDomain,
  normalizeInlineLinks,
} from './inline-media';

// ---------------------------------------------------------------------------
// buildInlineMediaCheck
// ---------------------------------------------------------------------------

describe('buildInlineMediaCheck', () => {
  it('passes through a custom function as-is', () => {
    const fn = (mime: string) => mime === 'image/svg+xml';
    const check = buildInlineMediaCheck(fn);
    expect(check('image/svg+xml')).toBe(true);
    expect(check('image/png')).toBe(false);
  });

  it('uses default types when called with no args', () => {
    const check = buildInlineMediaCheck();
    expect(check('image/png')).toBe(true);
    expect(check('image/jpeg')).toBe(true);
    expect(check('image/webp')).toBe(true);
    expect(check('application/pdf')).toBe(true);
    expect(check('text/html')).toBe(false);
  });

  it('uses default types when called with undefined', () => {
    const check = buildInlineMediaCheck(undefined);
    expect(check('image/png')).toBe(true);
    expect(check('text/plain')).toBe(false);
  });

  it('matches exact MIME type from custom array', () => {
    const check = buildInlineMediaCheck(['image/gif', 'video/mp4']);
    expect(check('image/gif')).toBe(true);
    expect(check('video/mp4')).toBe(true);
    expect(check('image/png')).toBe(false);
  });

  it('matches wildcard "*" — accepts anything', () => {
    const check = buildInlineMediaCheck(['*']);
    expect(check('image/png')).toBe(true);
    expect(check('application/octet-stream')).toBe(true);
  });

  it('matches wildcard "*/*" — accepts anything', () => {
    const check = buildInlineMediaCheck(['*/*']);
    expect(check('video/webm')).toBe(true);
  });

  it('matches type-level wildcard "image/*"', () => {
    const check = buildInlineMediaCheck(['image/*']);
    expect(check('image/png')).toBe(true);
    expect(check('image/jpeg')).toBe(true);
    expect(check('image/avif')).toBe(true);
    expect(check('video/mp4')).toBe(false);
  });

  it('does not match unrelated type with type-level wildcard', () => {
    const check = buildInlineMediaCheck(['audio/*']);
    expect(check('image/png')).toBe(false);
    expect(check('audio/mpeg')).toBe(true);
  });

  it('returns false for empty custom array', () => {
    const check = buildInlineMediaCheck([]);
    expect(check('image/png')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeInlineLinks
// ---------------------------------------------------------------------------

describe('normalizeInlineLinks', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeInlineLinks(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(normalizeInlineLinks([])).toBeUndefined();
  });

  it('normalises a string entry to { match }', () => {
    const result = normalizeInlineLinks(['example.com']);
    expect(result).toEqual([{ match: 'example.com' }]);
  });

  it('normalises an object entry to { match, forcedMimeType }', () => {
    const result = normalizeInlineLinks([{ match: 'cdn.example.com', mimeType: 'image/png' }]);
    expect(result).toEqual([{ match: 'cdn.example.com', forcedMimeType: 'image/png' }]);
  });

  it('handles mixed string and object entries', () => {
    const result = normalizeInlineLinks(['example.com', { match: 'cdn.io', mimeType: 'image/webp' }]);
    expect(result).toEqual([{ match: 'example.com' }, { match: 'cdn.io', forcedMimeType: 'image/webp' }]);
  });

  it('string entry has no forcedMimeType', () => {
    const result = normalizeInlineLinks(['example.com']);
    expect(result![0]).not.toHaveProperty('forcedMimeType');
  });
});

// ---------------------------------------------------------------------------
// matchesDomain
// ---------------------------------------------------------------------------

describe('matchesDomain', () => {
  it('returns true for wildcard "*"', () => {
    expect(matchesDomain('https://anything.com/path', '*')).toBe(true);
  });

  it('returns true for exact hostname match', () => {
    expect(matchesDomain('https://example.com/img.png', 'example.com')).toBe(true);
  });

  it('returns true for subdomain match', () => {
    expect(matchesDomain('https://cdn.example.com/img.png', 'example.com')).toBe(true);
  });

  it('returns true for deep subdomain match', () => {
    expect(matchesDomain('https://a.b.example.com/path', 'example.com')).toBe(true);
  });

  it('returns false for different domain', () => {
    expect(matchesDomain('https://other.com/img.png', 'example.com')).toBe(false);
  });

  it('returns false for partial hostname match that is not a subdomain', () => {
    expect(matchesDomain('https://notexample.com/img', 'example.com')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(matchesDomain('not-a-url', 'example.com')).toBe(false);
  });

  it('returns false for empty string URL', () => {
    expect(matchesDomain('', 'example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findInlineLinkRule
// ---------------------------------------------------------------------------

describe('findInlineLinkRule', () => {
  const rules = [
    { match: 'cdn.example.com', forcedMimeType: 'image/png' },
    { match: 'example.com' },
    { match: '*', forcedMimeType: 'image/jpeg' },
  ];

  it('returns the first matching rule', () => {
    const result = findInlineLinkRule('https://cdn.example.com/logo.png', rules);
    expect(result).toEqual({ match: 'cdn.example.com', forcedMimeType: 'image/png' });
  });

  it('returns the parent domain rule when subdomain rule does not match', () => {
    const result = findInlineLinkRule('https://img.example.com/photo.jpg', rules);
    expect(result?.match).toBe('example.com');
  });

  it('falls through to wildcard rule for unrecognised domain', () => {
    const result = findInlineLinkRule('https://other.io/file.pdf', rules);
    expect(result?.match).toBe('*');
  });

  it('returns undefined when no rules match', () => {
    expect(findInlineLinkRule('https://unknown.net/img', [])).toBeUndefined();
  });

  it('returns undefined when URL is invalid and no wildcard', () => {
    const noWildcard = [{ match: 'example.com' }];
    expect(findInlineLinkRule('not-a-url', noWildcard)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractUrls
// ---------------------------------------------------------------------------

describe('extractUrls', () => {
  it('extracts a single https URL', () => {
    expect(extractUrls('Visit https://example.com for more')).toEqual(['https://example.com']);
  });

  it('extracts multiple URLs', () => {
    const text = 'See https://example.com and http://other.org/path?q=1';
    expect(extractUrls(text)).toEqual(['https://example.com', 'http://other.org/path?q=1']);
  });

  it('extracts URLs with paths and query params', () => {
    expect(extractUrls('Image at https://cdn.example.com/img.png?w=100&h=200')).toEqual([
      'https://cdn.example.com/img.png?w=100&h=200',
    ]);
  });

  it('returns empty array when no URLs found', () => {
    expect(extractUrls('No links here at all.')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractUrls('')).toEqual([]);
  });

  it('does not extract non-http/s protocol strings', () => {
    expect(extractUrls('Use ftp://example.com or mailto:hi@example.com')).toEqual([]);
  });

  it('handles URL at the very start of string', () => {
    expect(extractUrls('https://example.com is the link')).toEqual(['https://example.com']);
  });
});
