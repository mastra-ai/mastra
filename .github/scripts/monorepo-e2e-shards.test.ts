import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import shards from '../../e2e-tests/monorepo/shards.cjs';

const { GROUPS, patternFor, shardCount } = shards;
const suite = readFileSync(new URL('../../e2e-tests/monorepo/monorepo.test.ts', import.meta.url), 'utf8');
const shardsOf = (name: string) =>
  Array.from({ length: shardCount }, (_, i) => i + 1).filter(shard => new RegExp(patternFor(shard)).test(name));

describe('monorepo E2E shards', () => {
  test.each([
    ['pnpm monorepo > dev > should resolve a workspace package', 1],
    ['pnpm monorepo > dev Ctrl-C > stops', 1],
    ['pnpm monorepo > build > should resolve tsconfig paths', 1],
    ['pnpm monorepo > build without externals > bundles', 2],
    ['pnpm monorepo > start > serves', 2],
    ['pnpm monorepo > workspace subpath externals > keeps', 3],
    ['pnpm monorepo > should resolve api routes', 4],
    ['pnpm monorepo > a block added later > runs somewhere', 4],
    ['builds a Bun workspace app with a packed workspace dependency', 4],
  ])('%s runs on shard %i only', (name, shard) => {
    expect(shardsOf(name)).toEqual([shard]);
  });

  // A renamed block would quietly move to the last shard; still run, but unbalanced.
  test.each(GROUPS.flat())('"%s" is a describe block in monorepo.test.ts', name => {
    expect(suite).toContain(`describe('${name}'`);
  });
});
