import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import type { TestSpecification } from 'vitest/node';
import { TimingSequencer } from '../../scripts/vitest-timing-sequencer';

const root = '/repo';

// Only the fields the sequencer reads.
const spec = (file: string, project: string, isolate = true, projectRoot = root) =>
  ({
    moduleId: `${root}/${file}`,
    project: { name: project, config: { isolate, root: projectRoot } },
  }) as unknown as TestSpecification;

const sequencer = (index: number, count: number) =>
  new TimingSequencer({ config: { root, shard: { index, count } } } as never);

async function split(specs: TestSpecification[], count: number) {
  const shards: TestSpecification[][] = [];
  for (let index = 1; index <= count; index++) shards.push(await sequencer(index, count).shard(specs));
  return shards;
}

const shardsOf = (shards: TestSpecification[][], match: (s: TestSpecification) => boolean) =>
  new Set(shards.flatMap((specs, i) => (specs.some(match) ? [i] : [])));

// Like packages/schema-compat: two isolate: false projects over the same files, plus some files
// only one of them runs; and memory, with one isolate: false project.
const schemaCompat = 'packages/schema-compat';
const specs = [
  ...Array.from({ length: 30 }, (_, i) => spec(`packages/core/src/f${i}.test.ts`, 'unit:core')),
  ...['a', 'b', 'c'].flatMap(name => [
    spec(`${schemaCompat}/src/${name}.test.ts`, 'unit:schema-compat:v4', false, `${root}/${schemaCompat}`),
    spec(`${schemaCompat}/src/${name}.test.ts`, 'unit:schema-compat:v3', false, `${root}/${schemaCompat}`),
  ]),
  spec(`${schemaCompat}/src/v4-only.test.ts`, 'unit:schema-compat:v4', false, `${root}/${schemaCompat}`),
  ...['x', 'y'].map(name =>
    spec(`packages/memory/src/${name}.test.ts`, 'unit:memory', false, `${root}/packages/memory`),
  ),
];

describe('TimingSequencer.shard', () => {
  const previous = process.env.VITEST_TEST_TIMINGS;
  afterEach(() => {
    if (previous === undefined) delete process.env.VITEST_TEST_TIMINGS;
    else process.env.VITEST_TEST_TIMINGS = previous;
  });

  for (const withTimings of [true, false]) {
    test(`runs every spec once and keeps isolate: false packages together (${withTimings ? 'with' : 'without'} timings)`, async () => {
      if (withTimings) {
        const dir = mkdtempSync(join(tmpdir(), 'timing-sequencer-'));
        const path = join(dir, 'timings.json');
        writeFileSync(
          path,
          JSON.stringify({ 'packages/core/src/f0.test.ts': 60_000, [`${schemaCompat}/src/a.test.ts`]: 20_000 }),
        );
        process.env.VITEST_TEST_TIMINGS = path;
      } else {
        process.env.VITEST_TEST_TIMINGS = 'none';
      }

      const shards = await split(specs, 4);

      expect(shards.flat()).toHaveLength(specs.length);
      expect(new Set(shards.flat())).toEqual(new Set(specs));
      expect(shardsOf(shards, s => s.moduleId.includes(schemaCompat)).size).toBe(1);
      expect(shardsOf(shards, s => s.moduleId.includes('packages/memory/')).size).toBe(1);
    });
  }
});
