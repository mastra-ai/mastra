import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import stripAnsi from 'strip-ansi';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Complete the max-runs goal e2e objective.';
const FOLLOW_UP = 'Looks good, please keep going.';

/**
 * Regression: once a goal has consumed its full run budget while still
 * `active` (the judge answered `waiting` on the final run, so the loop did not
 * pause it), every later chat turn hits the core goal step's budget guard. The
 * guard emitted a `goal` chunk with `status: 'active'` and `passed: false`
 * without invoking the judge or writing the record, which the TUI rendered as
 * `Goal ○ continue (N/N)` forever.
 *
 * Expected: reaching max runs ends the goal — no `continue` verdict is rendered
 * for the follow-up turn, `/goal status` no longer reports it active, and the
 * persisted objective is parked rather than left `active`.
 */
export const goalMaxRunsEndsGoalScenario: McE2eScenario = {
  name: 'goal-max-runs-ends-goal',
  description: 'A goal that reached max runs ends instead of rendering "continue" on every later chat turn.',
  testName: 'ends the goal at max runs instead of looping on continue',
  useOpenAIModel: true,
  aimockFixture: 'goal-max-runs-ends-goal.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 1,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    // Run 1/1: the judge answers `waiting`, exhausting the budget while the
    // goal stays active.
    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/First max-runs goal turn completed\./i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+◌\s+waiting\s+\(1\/1\)/i, terminal, 15_000);

    // A normal chat turn after the budget is spent. The fixture resolves this
    // turn whether the goal is still `active` when the request is built (it is
    // parked during the turn) or was already parked on an earlier turn.
    terminal.submit(FOLLOW_UP);
    await runtime.waitForScreenText(/Follow-up turn after max runs completed\./i, terminal, 15_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Goal \((\w+)\): "Complete the max-runs goal e2e objective\."/i, terminal, 8_000);

    const view = stripAnsi(terminal.serialize().view);
    const continueBoxes = view.match(/Goal\s+○\s+continue\s+\(1\/1\)/g)?.length ?? 0;
    if (continueBoxes !== 0) {
      throw new Error(
        `Expected no "continue" judge verdict after the goal reached max runs, found ${continueBoxes}:\n${view}`,
      );
    }

    const status = view.match(/Goal \((\w+)\): "Complete the max-runs goal e2e objective\."/i)?.[1];
    if (status === 'active') {
      throw new Error(
        `Expected the goal to end after reaching max runs, but /goal status still reports it active:\n${view}`,
      );
    }

    terminal.keyCtrlC();
    await runtime.stopApp?.();

    // The rendered verdict and `/goal status` both read the in-memory goal
    // mirror, so assert the durable record too: a change confined to the TUI
    // could satisfy the checks above while thread state stayed `active`.
    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare(`select value from mastra_thread_state where type = 'goal'`).all() as Array<{
        value: string;
      }>;
      if (rows.length !== 1) {
        throw new Error(`Expected exactly one persisted goal record, found ${rows.length}`);
      }
      const record = JSON.parse(rows[0]!.value) as { objective?: string; status?: string; runsUsed?: number };
      if (record.objective !== OBJECTIVE) {
        throw new Error(
          `Expected persisted objective ${JSON.stringify(OBJECTIVE)}, found ${JSON.stringify(record.objective)}`,
        );
      }
      if (record.status === 'active') {
        throw new Error('Expected the persisted goal to end after reaching max runs, but thread state is still active');
      }
      if (record.runsUsed !== 1) {
        throw new Error(`Expected 1 persisted run, found ${JSON.stringify(record.runsUsed)}`);
      }
    } finally {
      db.close();
    }
  },
  verifyAimockRequests(requests) {
    if (requests.length < 3) {
      throw new Error(
        `Expected an agent response, a goal judge request, and a follow-up agent response; received ${requests.length} AIMock requests`,
      );
    }
    const body = JSON.stringify(requests);
    if (!body.includes(OBJECTIVE)) {
      throw new Error('Expected AIMock requests to contain the goal objective');
    }
    if (!body.includes(FOLLOW_UP)) {
      throw new Error('Expected AIMock requests to contain the follow-up chat turn');
    }
  },
};
