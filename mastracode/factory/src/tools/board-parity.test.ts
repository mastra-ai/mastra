import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TOOLS = fileURLToPath(new URL('.', import.meta.url));

/**
 * Ways to change a card that skip the board's rules. The board's own routes move a card, start or
 * rerun its stage, and settle its proposals only through the transition service and the shared
 * decision actions (`work-items/decision-actions.ts`). A tool that reaches past them can do what the
 * board's buttons refuse: start a role whose stage the card is not in, or a second run on a busy card.
 * That is how `factory_start_session` used to start a card's role, straight from the start coordinator.
 */
const BYPASSES: readonly [pattern: RegExp, what: string][] = [
  [
    /\b(startCoordinator|FactoryStartCoordinator|prepareRunStart|markPendingStart)\b/,
    "a card's run started outside a move",
  ],
  [
    /\b(commitTransition|commitRuleEvaluation)\b/,
    'a stage change or queued run committed outside the transition service',
  ],
  [
    /\b(approve|dismiss|retry|propose|complete|claim)DeferredDecisions?\b|\bsupersede\w*Decisions?\b/,
    'a run settled outside the shared decision actions',
  ],
  [/\brecordSessionRunStart\b/, 'a run start recorded as if the board had started it'],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

describe('Factory tools', () => {
  it("change cards only through the code the board's own routes use", () => {
    const found: string[] = [];
    for (const path of sourceFiles(TOOLS)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const [pattern, what] of BYPASSES) {
            if (pattern.test(line)) found.push(`${relative(TOOLS, path)}:${index + 1} ${what}: ${line.trim()}`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
