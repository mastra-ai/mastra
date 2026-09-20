import { execFileSync } from 'node:child_process';
import stripAnsi from 'strip-ansi';
import { expect } from './expect.js';
import {
  GOAL_BOX_SIGNATURE,
  GOAL_JUDGE_BOX_SIGNATURE,
  GOAL_REMINDER_BOX_SIGNATURE,
  countGoalBoxes,
  countGoalReminderBoxes,
} from './goal-judge-single-render.js';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const OBJECTIVE = 'Resume the goal box e2e objective.';
const THREAD_ID = 'thread-goal-resume-single-render';
const THREAD_TITLE = 'E2E goal resume fixture';

export const goalResumeSingleRenderScenario: McE2eScenario = {
  name: 'goal-resume-single-render',
  description: 'Resume a seeded paused goal and render exactly one goal box from the echoed reminder.',
  testName: 'renders exactly one goal box when a paused goal resumes',
  useOpenAIModel: true,
  aimockFixture: 'goal-resume-single-render.json',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-07-16T12:00:00.000Z');
    const resourceId = 'mc-e2e-goal-resume-resource';
    const goal = {
      id: 'goal-mc-e2e-resume',
      objective: OBJECTIVE,
      status: 'paused',
      turnsUsed: 0,
      maxTurns: 3,
      judgeModelId: 'openai/gpt-5.4-mini',
      startedAt: '2026-07-16T11:59:00.000Z',
      activeStartedAt: undefined,
      activeDurationMs: 0,
      lastPauseWasJudgeFailure: false,
    };
    const metadata = JSON.stringify({ projectPath: projectDir, goal });
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Seeded resume user turn.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Seeded resume assistant turn.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(THREAD_ID)}, ${quoteSql(resourceId)}, ${quoteSql(THREAD_TITLE)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-goal-resume-user', ${quoteSql(THREAD_ID)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-goal-resume-assistant', ${quoteSql(THREAD_ID)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Select Thread/i, terminal, 8_000);
    terminal.write(THREAD_TITLE);
    await runtime.waitForScreenText(new RegExp(THREAD_TITLE, 'i'), terminal, 8_000);
    terminal.write('\r');

    // The seeded history has no goal reminder, so nothing renders a goal box
    // yet. `/goal status` prints the paused status line, which the box
    // signature must not count.
    terminal.submit('/goal status');
    await runtime.waitForScreenText(/Goal \(paused\): "Resume the goal box e2e objective\."/i, terminal, 8_000);
    const beforeResume = countGoalBoxes(stripAnsi(terminal.serialize().view));
    if (beforeResume !== 0) {
      throw new Error(`Expected no goal boxes before resume, found ${beforeResume}`);
    }

    terminal.submit('/goal resume');
    await runtime.waitForScreenText(/Resume goal box e2e work completed\./i, terminal, 15_000);
    await runtime.waitForScreenText(GOAL_JUDGE_BOX_SIGNATURE, terminal, 15_000);

    const view = stripAnsi(terminal.serialize().view);

    // Exactly one new box from the resume echo. A local render on top of the
    // echo (the duplicate this guards) would show two.
    const goalBoxCount = countGoalBoxes(view);
    console.info(`[goal-resume-single-render] goalBoxes=${goalBoxCount} signature=${GOAL_BOX_SIGNATURE.source}`);
    if (goalBoxCount !== 1) {
      throw new Error(`Expected exactly one goal box after resume, found ${goalBoxCount}:\n${view}`);
    }

    const reminderCount = countGoalReminderBoxes(view);
    console.info(
      `[goal-resume-single-render] goalReminderBoxes=${reminderCount} signature=${GOAL_REMINDER_BOX_SIGNATURE.source}`,
    );
    if (reminderCount !== 1) {
      throw new Error(
        `Expected exactly one budget-bearing goal reminder box after resume, found ${reminderCount}:\n${view}`,
      );
    }

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(
        `Expected at least 2 AIMock requests for the resumed run and judge decision, received ${requests.length}`,
      );
    }
    const body = JSON.stringify(requests);
    if (!body.includes(OBJECTIVE)) {
      throw new Error('Expected AIMock requests to contain the resumed goal objective');
    }
  },
};
