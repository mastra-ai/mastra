import { describe, expect, test } from 'vitest';
import shards from './test-shards.cjs';
import timings from './test-timings.cjs';

const { shardCount, assignShards, FILE_OVERHEAD_MS, UNKNOWN_FILE_MS } = shards;
const { timingsFromReport } = timings;

const files = (count: number) =>
  Array.from({ length: count }, (_, i) => `packages/core/src/f${String(i).padStart(4, '0')}.test.ts`);

describe('shardCount', () => {
  test('keeps a small change on one shard', () => {
    expect(shardCount({ files: files(3) })).toBe(1);
  });

  test('adds shards as the recorded time grows, up to the limit', () => {
    const list = files(400);
    const slow = Object.fromEntries(list.map(file => [file, 20_000]));
    expect(shardCount({ files: list, timings: slow, maxShards: 6 })).toBe(6);
    expect(shardCount({ files: list, timings: slow, maxShards: 20 })).toBeGreaterThan(6);
  });

  test('is zero for no files', () => {
    expect(shardCount({ files: [] })).toBe(0);
  });
});

describe('assignShards', () => {
  test('puts every file on exactly one shard', () => {
    const list = files(500);
    const record = Object.fromEntries(list.map((file, i) => [file, (i * 7919) % 30_000]));
    const plan = assignShards({ files: list, timings: record, count: 8 });

    const planned = plan.shards.flat();
    expect(plan.shards).toHaveLength(8);
    expect(planned).toHaveLength(list.length);
    expect(new Set(planned)).toEqual(new Set(list));
  });

  test('balances by duration, not by file count', () => {
    // One slow file and many fast ones: a count split would pair the slow file with half the rest.
    const list = files(41);
    const record = Object.fromEntries(list.map((file, i) => [file, i === 0 ? 400_000 : 10_000]));
    const plan = assignShards({ files: list, timings: record, count: 2 });

    const slowShard = plan.shards.find(shard => shard.includes(list[0]))!;
    expect(slowShard.length).toBeLessThan(list.length / 2);
    const [a, b] = plan.loads;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(10_000 + FILE_OVERHEAD_MS);
  });

  test('gives the same plan whatever order the files come in', () => {
    const list = files(200);
    const record = Object.fromEntries(list.map((file, i) => [file, (i * 31) % 5_000]));
    const options = { timings: record, count: 5 };
    expect(assignShards({ ...options, files: [...list].reverse() })).toEqual(assignShards({ ...options, files: list }));
  });

  test('costs a file without a record as an average one', () => {
    expect(assignShards({ files: ['new.test.ts'], count: 1 }).loads).toEqual([UNKNOWN_FILE_MS + FILE_OVERHEAD_MS]);
  });

  test('adds up a file that runs in several projects', () => {
    const plan = assignShards({
      files: ['a.test.ts'],
      timings: { 'unit:core|a.test.ts': 1_000, 'unit:core:other|a.test.ts': 2_000 },
      count: 1,
    });
    expect(plan.loads).toEqual([3_000 + FILE_OVERHEAD_MS]);
  });

  test('keeps a group on one shard', () => {
    const list = [
      ...files(40),
      'packages/memory/src/a.test.ts',
      'packages/memory/src/b.test.ts',
      'packages/memory/src/c.test.ts',
    ];
    const record = Object.fromEntries(list.map(file => [file, 20_000]));
    const groupOf = (file: string) => (file.startsWith('packages/memory/') ? 'unit:memory' : undefined);
    const plan = assignShards({ files: list, timings: record, count: 8, groupOf });

    const withMemory = plan.shards.filter(shard => shard.some(file => file.startsWith('packages/memory/')));
    expect(withMemory).toHaveLength(1);
    expect(withMemory[0]!.filter(file => file.startsWith('packages/memory/'))).toHaveLength(3);
    expect(plan.shards.flat()).toHaveLength(list.length);
  });
});

describe('timingsFromReport', () => {
  test('sums test durations per repository-relative file', () => {
    const report = {
      testResults: [
        { name: '/repo/packages/core/src/a.test.ts', assertionResults: [{ duration: 10.4 }, { duration: 5 }] },
        { name: '/repo/packages/core/src/a.test.ts', assertionResults: [{ duration: 4.6 }] },
        { name: '/repo/packages/core/src/b.test.ts', assertionResults: [{ duration: null }] },
        { name: '/elsewhere/c.test.ts', assertionResults: [{ duration: 1 }] },
      ],
    };
    expect(timingsFromReport(report, '/repo')).toEqual({
      'packages/core/src/a.test.ts': 20,
      'packages/core/src/b.test.ts': 0,
    });
  });
});
