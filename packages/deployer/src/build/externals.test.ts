import { describe, expect, it } from 'vitest';
import { isForceBundled, normalizeExternals } from './externals';

describe('normalizeExternals', () => {
  it('maps the legacy boolean forms onto presets', () => {
    expect(normalizeExternals(true)).toEqual({ preset: 'all', include: [], exclude: [] });
    expect(normalizeExternals(false)).toEqual({ preset: 'none', include: [], exclude: [] });
  });

  it('defaults to bundling everything when unset', () => {
    expect(normalizeExternals(undefined)).toEqual({ preset: 'none', include: [], exclude: [] });
  });

  it('treats the legacy array form as additive includes', () => {
    expect(normalizeExternals(['pg', 'sharp'])).toEqual({ preset: 'none', include: ['pg', 'sharp'], exclude: [] });
  });

  it('fills in defaults for a partial object', () => {
    expect(normalizeExternals({ preset: 'all' })).toEqual({ preset: 'all', include: [], exclude: [] });
    expect(normalizeExternals({ include: ['pg-native'] })).toEqual({
      preset: 'none',
      include: ['pg-native'],
      exclude: [],
    });
  });

  it('passes a full object through', () => {
    expect(normalizeExternals({ preset: 'all', include: ['pg-native'], exclude: ['broken-pkg'] })).toEqual({
      preset: 'all',
      include: ['pg-native'],
      exclude: ['broken-pkg'],
    });
  });
});

describe('isForceBundled', () => {
  const config = normalizeExternals({ preset: 'all', include: ['pg-native'], exclude: ['broken-pkg'] });

  it('force-bundles an excluded package', () => {
    expect(isForceBundled('broken-pkg', config)).toBe(true);
  });

  it('force-bundles subpaths of an excluded package', () => {
    expect(isForceBundled('broken-pkg/dist/index.js', config)).toBe(true);
  });

  it('leaves unrelated packages alone', () => {
    expect(isForceBundled('sharp', config)).toBe(false);
    // Not a subpath match — a prefix collision must not count.
    expect(isForceBundled('broken-pkg-other', config)).toBe(false);
  });

  it('never force-bundles something the user also asked to externalize', () => {
    const conflicting = normalizeExternals({ preset: 'all', include: ['pg-native'], exclude: ['pg-native'] });
    expect(isForceBundled('pg-native', conflicting)).toBe(false);
  });

  it('is a no-op without an exclude list', () => {
    expect(isForceBundled('anything', normalizeExternals(true))).toBe(false);
  });
});
