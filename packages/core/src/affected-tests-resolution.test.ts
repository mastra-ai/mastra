import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// madge ships no type declarations and is CommonJS.
const require = createRequire(import.meta.url);
type Madge = (
  paths: string[],
  options: Record<string, unknown>,
) => Promise<{ obj: () => Promise<Record<string, string[]>> }>;
const madge = require('madge') as Madge;

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const webpackConfigPath = path.join(repoRoot, 'scripts/madge.webpack.config.cjs');

// CI selects affected tests from a madge graph rooted at the test files. If the
// resolver in scripts/madge.webpack.config.cjs cannot map a specifier onto the
// file it points at, that edge is dropped and every package on the far side of
// it looks dependency-free — so changes there select zero tests instead of
// failing loudly. #24218 was exactly that for NodeNext-style `.js` specifiers.
describe('affected-test detector resolution', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(path.join(tmpdir(), 'affected-tests-resolution-'));
    // A NodeNext package reaches a `.ts` source through a `.js` specifier.
    writeFileSync(path.join(fixtureDir, 'target.ts'), 'export const value = 1;\n');
    writeFileSync(
      path.join(fixtureDir, 'entry.ts'),
      "import { value } from './target.js';\nexport const doubled = value * 2;\n",
    );
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('follows a .js specifier through to the .ts source it names', async () => {
    const res = await madge([path.join(fixtureDir, 'entry.ts')], {
      baseDir: fixtureDir,
      webpackConfig: webpackConfigPath,
      fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'],
    });

    const graph = await res.obj();
    const entry = Object.keys(graph).find(file => file.endsWith('entry.ts'));

    expect(entry, 'entry.ts should be a node in the graph').toBeDefined();
    const dependencies = entry ? (graph[entry] ?? []) : [];
    expect(dependencies.map(dep => path.basename(dep))).toContain('target.ts');
  });
});
