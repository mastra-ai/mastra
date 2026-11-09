// Splits and orders CI unit-test shards by how long each test file took last time. Active when
// VITEST_TEST_TIMINGS points at the recorded timings (.github/scripts/test-timings.cjs).
//
// shard(): `vitest --shard=k/N` normally hashes file paths and gives every shard the same number
// of files, so one shard can draw all the slow ones. This balances the shards by recorded
// duration instead (.github/scripts/test-shards.cjs), and keeps every file of a project with
// `isolate: false` on one shard: those files share module state, and splitting them made tests fail.
//
// sort(): Vitest orders files by project name before anything else, so a slow file in a project
// that sorts late (a 4-minute `@mastra/mcp` file, say) starts minutes into a shard. Files that took
// longer than SLOW_MS move to the front, slowest first, except in `isolate: false` projects, whose
// tests may depend on Vitest's usual order.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';
import testShards from '../.github/scripts/test-shards.cjs';

const SLOW_MS = 30_000;

function readTimings(): Record<string, number> | undefined {
  const path = process.env.VITEST_TEST_TIMINGS;
  if (!path) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

export class TimingSequencer extends BaseSequencer {
  private pathOf(spec: TestSpecification) {
    return relative(this.ctx.config.root, spec.moduleId).split('\\').join('/');
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const timings = readTimings();
    const { index, count } = this.ctx.config.shard ?? {};
    if (!timings || !index || !count) return super.shard(files);

    // Grouped by the project's directory, not its name: a package can define several projects over
    // the same files (schema-compat runs its tests once per Zod version), and they all stay together.
    const groups = new Map<string, string>();
    for (const spec of files) {
      if (spec.project.config.isolate === false) groups.set(this.pathOf(spec), spec.project.config.root);
    }
    const { shards } = testShards.assignShards({
      files: files.map(spec => this.pathOf(spec)),
      timings,
      count,
      groupOf: (file: string) => groups.get(file),
    });
    const mine = new Set(shards[index - 1]);
    return files.filter(spec => mine.has(this.pathOf(spec)));
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const timings = readTimings();
    if (!timings) return sorted;

    const durationOf = (spec: TestSpecification) =>
      spec.project.config.isolate === false ? 0 : (timings[this.pathOf(spec)] ?? 0);
    const slow = sorted.filter(spec => durationOf(spec) > SLOW_MS);
    if (slow.length === 0) return sorted;
    // Array.prototype.sort is stable, so equally slow files keep Vitest's order.
    slow.sort((a, b) => durationOf(b) - durationOf(a));
    const moved = new Set(slow);
    return [...slow, ...sorted.filter(spec => !moved.has(spec))];
  }
}
