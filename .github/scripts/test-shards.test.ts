import { describe, expect, test } from 'vitest';
import shards from './test-shards.cjs';
import timings from './test-timings.cjs';

const { planShards, FILE_OVERHEAD_MS, UNKNOWN_FILE_MS } = shards;
const { timingsFromReport } = timings;

const files = (count: number) =>
  Array.from({ length: count }, (_, i) => `packages/core/src/f${String(i).padStart(4, '0')}.test.ts`);

describe('planShards', () => {
  test('puts every file on exactly one shard', () => {
    const list = files(500);
    const record = Object.fromEntries(list.map((file, i) => [file, (i * 7919) % 30_000]));
    const plan = planShards({ files: list, timings: record, maxShards: 8, targetShardMs: 30_000 });

    const planned = plan.shards.flat();
    expect(planned).toHaveLength(list.length);
    expect(new Set(planned)).toEqual(new Set(list));
  });

  test('keeps a small change on one shard', () => {
    const plan = planShards({ files: files(3) });
    expect(plan.shards).toHaveLength(1);
  });

  test('adds shards as the recorded time grows, up to the limit', () => {
    const list = files(400);
    const slow = Object.fromEntries(list.map(file => [file, 20_000]));
    expect(planShards({ files: list, timings: slow, maxShards: 6 }).shards).toHaveLength(6);
    expect(planShards({ files: list, timings: slow, maxShards: 20 }).shards.length).toBeGreaterThan(6);
  });

  test('balances by duration, not by file count', () => {
    // One slow file and many fast ones: a count split would pair the slow file with half the rest.
    const list = files(41);
    const record = Object.fromEntries(list.map((file, i) => [file, i === 0 ? 400_000 : 10_000]));
    const plan = planShards({ files: list, timings: record, maxShards: 2, targetShardMs: 1, workers: 1 });

    const slowShard = plan.shards.find(shard => shard.includes(list[0]))!;
    expect(slowShard.length).toBeLessThan(list.length / 2);
    const [a, b] = plan.estimatedMs;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(10_000 + FILE_OVERHEAD_MS);
  });

  test('gives the same plan whatever order the files come in', () => {
    const list = files(200);
    const record = Object.fromEntries(list.map((file, i) => [file, (i * 31) % 5_000]));
    const options = { timings: record, maxShards: 5, targetShardMs: 10_000 };
    expect(planShards({ ...options, files: [...list].reverse() })).toEqual(planShards({ ...options, files: list }));
  });

  test('costs a file without a record as an average one', () => {
    const plan = planShards({ files: ['new.test.ts'], workers: 1 });
    expect(plan.estimatedMs).toEqual([UNKNOWN_FILE_MS + FILE_OVERHEAD_MS]);
  });

  test('adds up a file that runs in several projects', () => {
    const plan = planShards({
      files: ['a.test.ts'],
      timings: { 'unit:core|a.test.ts': 1_000, 'unit:core:other|a.test.ts': 2_000 },
      workers: 1,
    });
    expect(plan.estimatedMs).toEqual([3_000 + FILE_OVERHEAD_MS]);
  });

  test('keeps a group on one shard', () => {
    const list = [
      ...files(40),
      'packages/memory/src/a.test.ts',
      'packages/memory/src/b.test.ts',
      'packages/memory/src/c.test.ts',
    ];
    const record = Object.fromEntries(list.map(file => [file, 20_000]));
    const groupOf = (file: string) => (file.startsWith('packages/memory/') ? 'packages/memory' : undefined);
    const plan = planShards({ files: list, timings: record, maxShards: 8, targetShardMs: 1, groupOf });

    const withMemory = plan.shards.filter(shard => shard.some(file => file.startsWith('packages/memory/')));
    expect(withMemory).toHaveLength(1);
    expect(withMemory[0]!.filter(file => file.startsWith('packages/memory/'))).toHaveLength(3);
    expect(plan.shards.flat()).toHaveLength(list.length);
  });

  test('plans nothing for no files', () => {
    expect(planShards({ files: [] })).toEqual({ shards: [], estimatedMs: [] });
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
