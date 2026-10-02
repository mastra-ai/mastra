import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import stripAnsi from 'strip-ansi';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let restartApp: (() => Promise<void>) | undefined;

const OBJECTIVE = 'Complete the max-runs goal e2e objective.';
const FOLLOW_UP = 'Looks good, please keep going.';
const PAUSED_REASON = 'Ran out of evaluation budget (1 runs) before reaching the goal — raise maxRuns to resume.';

function readGoal(dbPath: string): { status?: string; pausedReason?: string } {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db.prepare(`select value from mastra_thread_state where type = 'goal'`).get() as
      | { value: string }
      | undefined;
    return row ? JSON.parse(row.value) : {};
  } finally {
    db.close();
  }
}

/**
 * Regression: once a goal has consumed its full run budget while still
 * `active` (the judge answered `waiting` on the final run, so the loop did not
 * pause it), every later chat turn hits the core goal step's budget guard. The
 * guard emitted a `goal` chunk with `status: 'active'` and `passed: false`
 * without invoking the judge or writing the record, which the TUI rendered as
 * `Goal ○ continue (N/N)` forever.
 *
 * Expected: reaching max runs ends the goal — no `continue` verdict is rendered
 * for the follow-up turn, `/goal status` reports it `paused` with the budget
 * reason, and the persisted objective is parked as `paused`.
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
  async inProcessApp({ startMastraCodeApp }) {
    let currentStop: (() => Promise<void> | void) | undefined;
    const start = async () => {
      currentStop = (await startMastraCodeApp()).stop;
    };
    restartApp = async () => {
      await currentStop?.();
      await start();
    };
    await start();
    return { stop: async () => currentStop?.() };
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    // Run 1/1: the judge answers `waiting`, exhausting the budget while the
    // goal stays active.
    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/First max-runs goal turn completed\./i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+◌\s+waiting\s+\(1\/1\)/i, terminal, 15_000);

    // A normal chat turn after the budget is spent. The goal is still `active`
    // when this request is built — the budget guard parks it during the turn —
    // so the FOLLOW_UP fixture matches on the message text it sends.
    terminal.submit(FOLLOW_UP);
    await runtime.waitForScreenText(/Follow-up turn after max runs completed\./i, terminal, 15_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Goal \((\w+)\): "Complete the max-runs goal e2e objective\."/i, terminal, 8_000);
    // The pause cause travels with the paused goal and is shown in /goal status.
    await runtime.waitForScreenText(/— paused: Ran\s+out\s+of\s+evaluation\s+budget\s+\(1\s+runs\)/i, terminal, 8_000);

    const view = stripAnsi(terminal.serialize().view);
    const continueBoxes = view.match(/Goal\s+○\s+continue\s+\(1\/1\)/g)?.length ?? 0;
    if (continueBoxes !== 0) {
      throw new Error(
        `Expected no "continue" judge verdict after the goal reached max runs, found ${continueBoxes}:\n${view}`,
      );
    }

    const status = view.match(/Goal \((\w+)\): "Complete the max-runs goal e2e objective\."/i)?.[1];
    if (status !== 'paused') {
      throw new Error(
        `Expected /goal status to report paused after reaching max runs, found ${JSON.stringify(status)}:\n${view}`,
      );
    }

    // Restart on the same app data: the pause cause must come back from
    // storage, not from the previous process's in-memory goal.
    const stored = readGoal(dbPath);
    if (stored.status !== 'paused' || stored.pausedReason !== PAUSED_REASON) {
      throw new Error(
        `Expected the stored goal paused with ${JSON.stringify(PAUSED_REASON)} before restart, found ${JSON.stringify(stored)}`,
      );
    }
    // The status line wraps, so collapse whitespace before counting the cause.
    const pauseLines = () =>
      stripAnsi(terminal.serialize().view)
        .replace(/\s+/g, ' ')
        .split('— paused: ' + PAUSED_REASON).length - 1;
    await restartApp?.();
    await runtime.waitForScreenText(/Project:/i, terminal, 30_000);
    await runtime.sleep(500);
    const before = pauseLines();
    terminal.submit('/goal status');
    const deadline = Date.now() + 10_000;
    while (pauseLines() <= before) {
      if (Date.now() > deadline) {
        throw new Error(`Expected /goal status after restart to show the pause cause:\n${terminal.serialize().view}`);
      }
      await runtime.sleep(200);
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
      const record = JSON.parse(rows[0]!.value) as {
        objective?: string;
        status?: string;
        runsUsed?: number;
        pausedReason?: string;
      };
      if (record.objective !== OBJECTIVE) {
        throw new Error(
          `Expected persisted objective ${JSON.stringify(OBJECTIVE)}, found ${JSON.stringify(record.objective)}`,
        );
      }
      if (record.status !== 'paused') {
        throw new Error(
          `Expected the persisted goal to be paused after reaching max runs, found ${JSON.stringify(record.status)}`,
        );
      }
      if (record.pausedReason !== PAUSED_REASON) {
        throw new Error(`Expected the persisted pause cause, found ${JSON.stringify(record.pausedReason)}`);
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
