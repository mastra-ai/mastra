// Splits one file's tests across CI jobs. Vitest's --shard only splits by file, and the
// durability suites are a few files of many slow tests (each one starts, kills and restarts real
// processes, so most of their time is waiting), so they run one test file per job at best.
//
// With VITEST_TEST_SHARD=<index>/<count>, a test runs only on the shard its position in the file
// maps to; every other test is skipped before its own hooks start any processes. Every shard
// collects the same tests in the same order, so each test runs on exactly one shard.
import { beforeEach } from 'vitest';
import type { RunnerTestCase, RunnerTestSuite } from 'vitest';

function parseShard(value: string | undefined): { index: number; count: number } | undefined {
  const match = value?.match(/^(\d+)\/(\d+)$/);
  if (!match) return undefined;
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (count < 1 || index < 1 || index > count) {
    throw new Error(`VITEST_TEST_SHARD must be <index>/<count> with 1 <= index <= count, got ${value}`);
  }
  return { index, count };
}

function testsInOrder(suite: RunnerTestSuite, out: RunnerTestCase[] = []): RunnerTestCase[] {
  for (const task of suite.tasks) {
    if (task.type === 'test') out.push(task);
    else if (task.type === 'suite') testsInOrder(task, out);
  }
  return out;
}

// Spreads each file's first test over the shards, so files with few tests don't all start on 1.
function fileOffset(path: string, count: number): number {
  let hash = 0;
  for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % count;
}

const shard = parseShard(process.env.VITEST_TEST_SHARD);

if (shard) {
  beforeEach(context => {
    const file = context.task.file;
    const position = testsInOrder(file).indexOf(context.task as RunnerTestCase);
    if (position === -1) return;
    const assigned = ((position + fileOffset(file.name, shard.count)) % shard.count) + 1;
    if (assigned !== shard.index) context.skip(`runs on test shard ${assigned}/${shard.count}`);
  });
}
