// Starts the slowest test files of a CI unit-test shard first.
//
// Vitest orders files by project name before anything else, so a slow file in a project that sorts
// late (a 4-minute `@mastra/mcp` file, say) starts minutes into a shard and the shard runs that much
// longer. When VITEST_SLOW_FIRST_TIMINGS points at the shard planner's timings
// (.github/scripts/test-timings.cjs), files that took longer than SLOW_MS move to the front, slowest
// first. Everything else keeps Vitest's own order.
//
// Files of projects with `isolate: false` are never moved: those files share module state, and
// their tests may depend on running in Vitest's usual order.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';

const SLOW_MS = 30_000;

function readTimings(path: string | undefined): Record<string, number> | undefined {
  if (!path) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

export class SlowFirstSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const timings = readTimings(process.env.VITEST_SLOW_FIRST_TIMINGS);
    if (!timings) return sorted;

    const root = this.ctx.config.root;
    const durationOf = (spec: TestSpecification) => {
      if (spec.project.config.isolate === false) return 0;
      return timings[relative(root, spec.moduleId).split('\\').join('/')] ?? 0;
    };
    const slow = sorted.filter(spec => durationOf(spec) > SLOW_MS);
    if (slow.length === 0) return sorted;
    // Array.prototype.sort is stable, so equally slow files keep Vitest's order.
    slow.sort((a, b) => durationOf(b) - durationOf(a));
    const moved = new Set(slow);
    return [...slow, ...sorted.filter(spec => !moved.has(spec))];
  }
}
