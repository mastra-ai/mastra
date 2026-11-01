import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// madge ships no type declarations and is CommonJS.
const require = createRequire(import.meta.url);
type Graph = Record<string, string[]>;
type Madge = (paths: string[], options: Record<string, unknown>) => Promise<{ obj: () => Promise<Graph> }>;
const madge = require('madge') as Madge;

type ExtractionCache = { stats: { hits: number; misses: number }; save: () => void };
type CacheModule = {
  openExtractionCache: (path: string) => ExtractionCache;
  cacheMadgeSpecifiers: (cache: ExtractionCache) => () => void;
};

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const webpackConfigPath = path.join(repoRoot, 'scripts/madge.webpack.config.cjs');

// CI's affected-test detection caches what it extracts from each file by the
// file's content hash, so a warm cache must give the same graph as no cache,
// including after a file's imports change.
describe('affected-test detector extraction cache', () => {
  let fixtureDir: string;
  let cacheFile: string;
  let cacheModule: CacheModule;

  const write = (name: string, text: string) => writeFileSync(path.join(fixtureDir, name), text);

  async function graph(cache?: ExtractionCache): Promise<Graph> {
    const restore = cache ? cacheModule.cacheMadgeSpecifiers(cache) : undefined;
    try {
      const res = await madge([path.join(fixtureDir, 'entry.test.ts')], {
        baseDir: fixtureDir,
        webpackConfig: webpackConfigPath,
        fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      });
      return await res.obj();
    } finally {
      restore?.();
    }
  }

  beforeAll(async () => {
    cacheModule = (await import(
      pathToFileURL(path.join(repoRoot, 'scripts/affected-tests-cache.mjs')).href
    )) as CacheModule;
    // realpath: on macOS tmpdir() is a symlink, and madge keys nodes by real path.
    fixtureDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'affected-tests-cache-')));
    cacheFile = path.join(fixtureDir, '.cache', 'extraction.json');
    write('entry.test.ts', "import { a } from './a.js';\nexport const t = a;\n");
    write('a.ts', "import { b } from './b';\nexport const a = b;\n");
    write('b.ts', 'export const b = 1;\n');
    write('c.ts', 'export const c = 2;\n');
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('gives the uncached graph when cold, warm, and after a file changes its imports', async () => {
    const uncached = await graph();
    expect(uncached['a.ts']).toEqual(['b.ts']);

    const cold = cacheModule.openExtractionCache(cacheFile);
    expect(await graph(cold)).toEqual(uncached);
    expect(cold.stats.hits).toBe(0);
    cold.save();

    const warm = cacheModule.openExtractionCache(cacheFile);
    expect(await graph(warm)).toEqual(uncached);
    expect(warm.stats.misses).toBe(0);
    warm.save();

    write('a.ts', "import { b } from './b';\nimport { c } from './c';\nexport const a = b + c;\n");
    const changedUncached = await graph();
    expect(changedUncached['a.ts']).toEqual(['b.ts', 'c.ts']);

    const afterChange = cacheModule.openExtractionCache(cacheFile);
    expect(await graph(afterChange)).toEqual(changedUncached);
    // a.ts has new text and c.ts is newly reached; b.ts and the test come from the cache.
    expect(afterChange.stats.misses).toBe(2);
    expect(afterChange.stats.hits).toBe(2);
  });
});
