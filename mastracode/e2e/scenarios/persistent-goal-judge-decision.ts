import { execFileSync } from 'node:child_process';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const OBJECTIVE = 'Drive the persistent goal judge e2e until it is done.';

export const persistentGoalJudgeDecisionScenario: McE2eScenario = {
  name: 'persistent-goal-judge-decision',
  description: 'Drive a persisted active goal through judge continue and done decisions in the real TUI.',
  testName: 'continues and completes a persistent goal from AIMock judge decisions',
  skipReason: 'current main goal judge flow emits changed structured decision text and does not complete this fixture path',
  useOpenAIModel: true,
  aimockFixture: 'persistent-goal-judge-decision.json',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-07T12:30:00.000Z');
    const resourceId = 'mc-e2e-goal-judge-resource';
    const threadId = 'thread-mc-e2e-goal-judge';
    const goal = {
      id: 'goal-mc-e2e-judge',
      objective: OBJECTIVE,
      status: 'paused',
      turnsUsed: 0,
      maxTurns: 3,
      judgeModelId: 'openai/gpt-5.4-mini',
      startedAt: '2026-06-07T12:29:00.000Z',
      activeStartedAt: undefined,
      activeDurationMs: 0,
      lastPauseWasJudgeFailure: true,
    };
    const metadata = JSON.stringify({ projectPath: projectDir, goal });
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Seeded goal judge user turn.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Initial goal judge e2e work completed, with one follow-up still required.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'E2E goal judge fixture', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-goal-judge-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-goal-judge-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E goal judge fixture/i, terminal, 8_000);
    terminal.write('goal judge');
    await runtime.waitForScreenText(/E2E goal judge fixture/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E goal judge fixture/i, terminal, 8_000);
    terminal.submit('/goal status');
    await runtime.waitForScreenText(
      /Goal \(paused\): "Drive the persistent goal judge e2e until it is done\."/i,
      terminal,
      8_000,
    );

    terminal.submit('/goal resume');
    await runtime.waitForScreenText(/retriggering judge evaluation/i, terminal, 8_000);
    await runtime.waitForScreenText(/Goal judge follow-up e2e step completed/i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done\s+\(2\/3\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/The persistent goal judge e2e objective is complete/i, terminal, 15_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(
      /Goal \(done\): "Drive the persistent goal judge e2e until it is done\." — 2\/3 turns used/i,
      terminal,
      8_000,
    );

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 3) {
      throw new Error(
        `Expected at least 3 AIMock requests for judge continue, continuation, and judge done; received ${requests.length}`,
      );
    }
    const body = JSON.stringify(requests);
    if (!body.includes('Seeded goal judge user turn.')) {
      throw new Error('Expected AIMock requests to include the loaded conversation context');
    }
    if (!body.includes('Continue by reporting the goal judge follow-up e2e step.')) {
      throw new Error('Expected continuation request to include the judge continue reason');
    }
  },
};
