import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSignal } from '@mastra/core/signals';
import stripAnsi from 'strip-ansi';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Complete the single-render goal judge e2e objective.';
const HISTORY_THREAD_ID = 'thread-goal-judge-single-render-history';
const HISTORY_THREAD_TITLE = 'E2E goal judge history fixture';
export const GOAL_JUDGE_BOX_SIGNATURE = /Goal\s+●\s+done\s+\(1\/3\)/g;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function countJudgeBoxes(view: string): number {
  return stripAnsi(view).match(GOAL_JUDGE_BOX_SIGNATURE)?.length ?? 0;
}

function writeProofCounts(live: number, reload: number | null): void {
  const outputPath = process.env.MC_E2E_GOAL_JUDGE_PROOF_OUT;
  if (outputPath) {
    writeFileSync(outputPath, JSON.stringify({ live, reload }));
  }
}

export const goalJudgeSingleRenderScenario: McE2eScenario = {
  name: 'goal-judge-single-render',
  description: 'Render one live goal judge result and reconstruct one persisted result from history.',
  testName: 'renders one goal judge box live and one persisted box from history',
  useOpenAIModel: true,
  aimockFixture: 'goal-judge-single-render.json',
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 3,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const createdAt = new Date('2026-07-16T12:00:00.000Z').toISOString();
    const resourceId = 'mc-e2e-goal-judge-history';
    const signalMessage = createSignal({
      id: 'signal-goal-judge-single-render-history',
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'done (1/3)\nThe single-render goal judge e2e objective is complete.',
      attributes: { type: 'goal-judge' },
      metadata: {
        goalEvaluation: {
          objective: OBJECTIVE,
          iteration: 1,
          maxRuns: 3,
          passed: true,
          status: 'done',
          results: [],
          reason: 'The single-render goal judge e2e objective is complete.',
          duration: 0,
          timedOut: false,
          maxRunsReached: false,
          suppressFeedback: false,
        },
      },
    }).toDBMessage();
    const threadMetadata = JSON.stringify({ projectPath: projectDir });
    execFileSync('sqlite3', [
      dbPath,
      `insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
       values (${quoteSql(HISTORY_THREAD_ID)}, ${quoteSql(resourceId)}, ${quoteSql(HISTORY_THREAD_TITLE)}, ${quoteSql(threadMetadata)}, ${quoteSql(createdAt)}, ${quoteSql(createdAt)});
       insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
       values (${quoteSql(signalMessage.id)}, ${quoteSql(HISTORY_THREAD_ID)}, ${quoteSql(JSON.stringify(signalMessage.content))}, 'signal', 'v2', ${quoteSql(createdAt)}, ${quoteSql(resourceId)});`,
    ]);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/Single-render goal work completed\./i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done\s+\(1\/3\)/i, terminal, 15_000);

    const liveView = stripAnsi(terminal.serialize().view);
    const liveCount = countJudgeBoxes(liveView);
    writeProofCounts(liveCount, null);
    console.info(`[goal-judge-single-render] live=${liveCount} signature=${GOAL_JUDGE_BOX_SIGNATURE.source}`);
    if (liveCount !== 1) {
      throw new Error(`Expected exactly one live judge box, found ${liveCount}:\n${liveView}`);
    }
    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal, 8_000);
    terminal.submit('/threads');
    await runtime.waitForScreenText(/Select Thread/i, terminal, 8_000);
    terminal.write(HISTORY_THREAD_TITLE);
    await runtime.waitForScreenText(new RegExp(HISTORY_THREAD_TITLE, 'i'), terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(new RegExp(`Switched to: ${HISTORY_THREAD_TITLE}`, 'i'), terminal, 8_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done\s+\(1\/3\)/i, terminal, 8_000);

    const reloadCount = countJudgeBoxes(terminal.serialize().view);
    writeProofCounts(liveCount, reloadCount);
    console.info(`[goal-judge-single-render] reload=${reloadCount} signature=${GOAL_JUDGE_BOX_SIGNATURE.source}`);
    expect(Array.from({ length: reloadCount })).toHaveLength(1);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(`Expected an agent response and goal judge request; received ${requests.length} AIMock requests`);
    }
    const body = JSON.stringify(requests);
    if (!body.includes(OBJECTIVE)) {
      throw new Error('Expected AIMock requests to contain the goal objective');
    }
  },
};
