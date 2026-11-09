import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Work's seed and the readers of rows written before other boards existed. */
const SEED_AND_LEGACY = new Set([
  'boards/work.ts',
  // The retired Review board, kept for projects that still use it.
  'boards/review.ts',
  'boards/work-routes.ts',
  'boards/work-migrations.ts',
  'boards/legacy-plan-role.ts',
  'storage/domains/work-items/legacy-review.ts',
]);

/** Lines that match a pattern but name something other than a board or phase. */
const NOT_PHASES: readonly [file: string, line: string, why: string][] = [
  ['storage/domains/work-items/metrics.ts', "includes('canceled')", 'a metrics outcome'],
  ['tools/reports.ts', "['done', 'failed']", 'run report statuses'],
  ['boards/define-board.ts', "keys.includes('canceled')", "the keys of a board's sourceClosed"],
  ['integrations/linear/integration.ts', '"triage", "backlog"', 'Linear workflow state types'],
  ['integrations/github/routes.ts', "GithubIntegration['intake']", 'the intake API of the integration'],
];

const KEYS = 'work|review|pr-review|planning|execute|intake|triage|done|canceled';
const PATTERNS = [
  // board === 'work', stage: 'done', role ?? 'work', ...
  new RegExp(
    `\\b(board|boardId|stage|stages|phase|phaseKey|role|lane|destinationStage|initialPhase)\\w*\\??\\s*(===|!==|:|=|\\?\\?)\\s*['"\`](${KEYS})['"\`]`,
  ),
  new RegExp(`['"\`](${KEYS})['"\`]\\s*(===|!==)\\s*\\w*(board|stage|phase|role)`),
  new RegExp(`\\.(includes|has)\\(\\s*['"\`](${KEYS})['"\`]\\s*\\)`),
  /\[\s*['"`](intake|triage|planning|execute|pr-review|done|canceled)['"`]\s*[,\]]/,
  /['"`]pr-review['"`]/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && entry.name !== 'test-utils.ts'
      ? [path]
      : [];
  });
}

describe("Factory's runtime", () => {
  it("reads no board or phase by Work's keys outside Work's seed and the legacy readers", () => {
    const found: string[] = [];
    for (const path of sourceFiles(SRC)) {
      const file = relative(SRC, path);
      if (SEED_AND_LEGACY.has(file)) continue;
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (!PATTERNS.some(pattern => pattern.test(line))) return;
          if (NOT_PHASES.some(([allowed, text]) => allowed === file && line.includes(text))) return;
          found.push(`${file}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
