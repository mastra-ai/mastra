import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';

/**
 * Regression test for the same-class bug fixed by #17366: stored file parts can be
 * v5-shaped (`mediaType`/`url`) even though `fromAIV4Part`'s `file` branch only reads
 * the v4 shape (`mimeType`/`data`). Both fields read as `undefined` for a v5-shaped
 * part, so two DISTINCT v5 file parts (different `mediaType`/`url`) collapse onto the
 * SAME cache key — which lets `MessageMerger` wrongly treat them as duplicates and
 * drop one.
 */
describe('CacheKeyGenerator file part mediaType/url (mirrors #17366)', () => {
  const v5FilePart = (mediaType: string, url: string) => ({ type: 'file' as const, mediaType, url }) as any;

  it('fromAIV4Part produces different keys for two v5-shaped file parts with different mediaType/url', () => {
    const partA = v5FilePart('application/pdf', 'https://example.com/a.pdf');
    const partB = v5FilePart('image/png', 'https://example.com/b.png');

    const keyA = CacheKeyGenerator.fromAIV4Part(partA);
    const keyB = CacheKeyGenerator.fromAIV4Part(partB);

    expect(keyA).not.toBe(keyB);
  });

  it('fromDBParts (the MessageMerger dedup path) produces different keys for two v5-shaped file parts', () => {
    const partsA = [v5FilePart('application/pdf', 'https://example.com/a.pdf')];
    const partsB = [v5FilePart('image/png', 'https://example.com/b.png')];

    const keyA = CacheKeyGenerator.fromDBParts(partsA);
    const keyB = CacheKeyGenerator.fromDBParts(partsB);

    expect(keyA).not.toBe(keyB);
  });

  it('fromAIV4Part still works for a persisted v4 file part (mimeType/data)', () => {
    const v4Part = { type: 'file' as const, mimeType: 'application/pdf', data: 'JVBERi0xLjQ=' } as any;

    const key = CacheKeyGenerator.fromAIV4Part(v4Part);

    expect(key).toContain('JVBERi0xLjQ=');
    expect(key).toContain('application/pdf');
  });
});
