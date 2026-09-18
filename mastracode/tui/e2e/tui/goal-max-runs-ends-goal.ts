import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Complete the max-runs goal e2e objective.';
const FOLLOW_UP = 'Looks good, please keep going.';

/**
 * Regression: once a goal has consumed its full run budget while still
 * `active` (the judge answered `waiting` on the final run, so the loop did not
 * pause it), every later chat turn hits the core goal step's budget guard. The
 * guard emits a `goal` chunk with `status: 'active'` and `passed: false` without
 * invoking the judge, which the TUI renders as `Goal ○ continue (N/N)` forever.
 *
 * Expected: reaching max runs ends the goal — no `continue` verdict is rendered
 * for the follow-up turn and `/goal status` no longer reports it as active.
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
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    // Run 1/1: the judge answers `waiting`, exhausting the budget while the
    // goal stays active.
    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/First max-runs goal turn completed\./i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+◌\s+waiting\s+\(1\/1\)/i, terminal, 15_000);

    // A normal chat turn after the budget is spent.
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
