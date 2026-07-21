import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Exercise two sequential approval boundaries while tracking active goal time.';
let dbPath = '';

function readGoal(dbPath: string): { activeDurationMs: number; status: string } {
  const value = execFileSync(
    'sqlite3',
    [
      dbPath,
      `select json_extract(value, '$.activeDurationMs') || '|' || json_extract(value, '$.status') from mastra_thread_state where type = 'goal' order by updatedAt desc limit 1;`,
    ],
    { encoding: 'utf8' },
  ).trim();
  const [duration, status] = value.split('|');
  return { activeDurationMs: Number(duration), status: status ?? '' };
}

export const goalDurationToolApprovalScenario: McE2eScenario = {
  name: 'goal-duration-tool-approval',
  description: 'Exclude two sequential tool approval waits from durable active goal duration.',
  testName: 'excludes sequential tool approval waits from active goal duration in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'goal-duration-tool-approval.json',
  prepare: context => {
    dbPath = context.dbPath;
    const settingsPath = join(context.appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 1,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  env: () => ({ MASTRACODE_YOLO: null }),
  inProcessApp: ({ startMastraCodeApp }) =>
    startMastraCodeApp({
      config: { initialState: { yolo: false } },
    }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/APPROVAL_ONE_DONE/i, terminal, 15_000);
    await runtime.waitForScreenText(/Tool Approval Required/i, terminal, 8_000);
    runtime.printScreen('goal-duration approval 1 visible', terminal);

    const beforeFirst = readGoal(dbPath);
    await runtime.sleep(1_100);
    const afterFirstWait = readGoal(dbPath);
    if (
      beforeFirst.status !== 'active' ||
      afterFirstWait.status !== 'active' ||
      afterFirstWait.activeDurationMs !== beforeFirst.activeDurationMs
    ) {
      throw new Error(
        `First approval wait changed goal state: before=${JSON.stringify(beforeFirst)} after=${JSON.stringify(afterFirstWait)}`,
      );
    }
    terminal.write('y');

    await runtime.waitForScreenText(/APPROVAL_TWO_SHOULD_NOT_RUN/i, terminal, 15_000);
    await runtime.waitForScreenText(/Tool Approval Required/i, terminal, 8_000);
    runtime.printScreen('goal-duration approval 2 visible', terminal);

    const beforeSecond = readGoal(dbPath);
    if (beforeSecond.activeDurationMs <= beforeFirst.activeDurationMs) {
      throw new Error(
        `Active tool execution was not counted: first=${beforeFirst.activeDurationMs} second=${beforeSecond.activeDurationMs}`,
      );
    }
    await runtime.sleep(1_100);
    const afterSecondWait = readGoal(dbPath);
    if (
      beforeSecond.status !== 'active' ||
      afterSecondWait.status !== 'active' ||
      afterSecondWait.activeDurationMs !== beforeSecond.activeDurationMs
    ) {
      throw new Error(
        `Second approval wait changed goal state: before=${JSON.stringify(beforeSecond)} after=${JSON.stringify(afterSecondWait)}`,
      );
    }
    terminal.write('n');

    await runtime.waitForScreenText(/Sequential tool approval timing complete\./i, terminal, 15_000);
    terminal.submit('/goal status');
    await runtime.waitForScreenText(new RegExp(OBJECTIVE, 'i'), terminal, 8_000);
    const finalGoal = readGoal(dbPath);
    if (finalGoal.activeDurationMs <= beforeSecond.activeDurationMs) {
      throw new Error(
        `Active execution after the second approval was not checkpointed: before=${beforeSecond.activeDurationMs} final=${finalGoal.activeDurationMs}`,
      );
    }
    process.stdout.write(
      `GOAL_DURATION_APPROVAL_CHECKPOINT before1=${beforeFirst.activeDurationMs} afterWait1=${afterFirstWait.activeDurationMs} before2=${beforeSecond.activeDurationMs} afterWait2=${afterSecondWait.activeDurationMs} final=${finalGoal.activeDurationMs}\n`,
    );
    runtime.printScreen('goal-duration approval final status', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    for (const needle of ['call_goal_duration_approval_one', 'call_goal_duration_approval_two']) {
      if (!body.includes(needle)) throw new Error(`Expected AIMock request flow to include ${needle}`);
    }
  },
};
