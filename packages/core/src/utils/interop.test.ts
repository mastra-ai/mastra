import { describe, expect, it } from 'vitest';
import { loadPMap } from './p-map';
import { loadSlugify } from './slugify';

describe('ESM-only dependency loaders', () => {
  it('caches and resolves the slugify default export', async () => {
    const first = loadSlugify();
    const second = loadSlugify();

    expect(second).toBe(first);
    await expect(first.then(slugify => slugify('My Server Id'))).resolves.toBe('my-server-id');
  });

  it('caches and resolves p-map with pMapSkip', async () => {
    const first = loadPMap();
    const second = loadPMap();

    expect(second).toBe(first);

    const { default: pMap, pMapSkip } = await first;
    await expect(pMap([1, 2], async value => (value === 1 ? pMapSkip : value * 2))).resolves.toEqual([4]);
  });
});
