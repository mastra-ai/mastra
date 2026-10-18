import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LibSQLStore } from '@mastra/libsql';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eInProcessAppContext, McE2eScenario, McE2eTerminal } from './types.js';

const OBJECTIVE = 'Complete the judge Esc pause e2e objective.';
const JUDGE_PREFIX = `Goal: ${OBJECTIVE}`;
const PAUSED_REASON = 'Judge evaluation was interrupted.';

let judgeRequests = 0;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return '';
}

/**
 * Hold every goal judge request open until it is aborted, so Esc always lands
 * while the judge is running.
 */
async function startWithHeldJudge({ startMastraCodeApp }: McE2eInProcessAppContext): Promise<McE2eInProcessApp> {
  judgeRequests = 0;
  const patches = createGlobalPatchScope();
  const originalFetch = globalThis.fetch.bind(globalThis);
  patches.setProperty(globalThis, 'fetch', async (input, init) => {
    const url = requestUrl(input);
    const isModelCall = url.includes('/chat/completions') || url.includes('/responses');
    if (!isModelCall || !requestBodyText(init?.body).includes(JUDGE_PREFIX)) return originalFetch(input, init);

    judgeRequests += 1;
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
  });

  try {
    const app = await startMastraCodeApp();
    return { stop: () => patches.stopApp(app.stop) };
  } catch (error) {
    patches.restore();
    throw error;
  }
}

function prepareJudgeSettings({ appDataDir }: { appDataDir: string }): void {
  const settingsPath = join(appDataDir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
  settings.models = { ...settings.models, goalJudgeModel: 'openai/gpt-5.4-mini', goalMaxTurns: 3 };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

async function pressEscDuringJudge(terminal: McE2eTerminal, runtime: any): Promise<void> {
  await runtime.waitForScreenText(/Judge work completed\./i, terminal, 20_000);
  const deadline = Date.now() + 20_000;
  while (judgeRequests === 0) {
    if (Date.now() > deadline) throw new Error('Expected the goal judge to start');
    await runtime.sleep(100);
  }
  await runtime.sleep(500);
  terminal.write('\u001b');
  await runtime.sleep(1500);
  terminal.keyCtrlC();
  await runtime.stopApp?.();
}

function assertPausedByEsc(dbPath: string): void {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare(`select value from mastra_thread_state where type = 'goal'`).all() as Array<{
      value: string;
    }>;
    if (rows.length !== 1) throw new Error(`Expected exactly one persisted goal record, found ${rows.length}`);
    const record = JSON.parse(rows[0]!.value) as { objective?: string; status?: string; pausedReason?: string };
    if (record.objective !== OBJECTIVE) {
      throw new Error(`Expected persisted objective ${JSON.stringify(OBJECTIVE)}, found ${JSON.stringify(record)}`);
    }
    if (record.status !== 'paused' || record.pausedReason !== PAUSED_REASON) {
      throw new Error(
        `Expected the goal paused with ${JSON.stringify(PAUSED_REASON)}, found ${JSON.stringify(record)}`,
      );
    }
  } finally {
    db.close();
  }
}

/**
 * Esc during a goal judge run pauses the goal when this TUI has nothing loaded
 * in memory: another client wrote the goal to the same database, so the
 * in-memory pause was a no-op and the stored goal stayed `active`.
 */
export const goalJudgeEscUnloadedScenario: McE2eScenario = {
  name: 'goal-judge-esc-unloaded',
  description: 'Esc during a judge run pauses a goal another client wrote to the same database.',
  testName: 'persists the Esc pause when the goal is not loaded in memory',
  useOpenAIModel: true,
  aimockFixture: 'goal-judge-esc-pause.json',
  prepare: prepareJudgeSettings,
  inProcessApp: startWithHeldJudge,
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Start the thread.');
    await runtime.waitForScreenText(/Thread started\./i, terminal, 20_000);

    // A second client writes the goal for this thread through its own store.
    const reader = new DatabaseSync(dbPath, { readOnly: true });
    const thread = reader.prepare('select id from mastra_threads order by createdAt desc limit 1').get() as
      | { id: string }
      | undefined;
    reader.close();
    if (!thread) throw new Error('Expected a thread before writing the goal');
    const otherClient = new LibSQLStore({ id: 'goal-judge-esc-other-client', url: `file:${dbPath}` });
    const threadState = (await otherClient.getStore('threadState')) as any;
    const now = Date.now();
    await threadState.setState({
      threadId: thread.id,
      type: 'goal',
      value: {
        id: 'goal-judge-esc-unloaded',
        objective: OBJECTIVE,
        status: 'active',
        runsUsed: 0,
        activeDurationMs: 0,
        startedAt: now,
        updatedAt: now,
        maxRuns: 3,
        judgeModelId: 'openai/gpt-5.4-mini',
      },
    });
    await otherClient.close?.();

    terminal.submit(OBJECTIVE);
    await pressEscDuringJudge(terminal, runtime);
    assertPausedByEsc(dbPath);
  },
};

/** Esc during a judge run pauses a goal set in this TUI and persists the cause. */
export const goalJudgeEscLoadedScenario: McE2eScenario = {
  name: 'goal-judge-esc-loaded',
  description: 'Esc during a judge run pauses a goal loaded in memory and persists the cause.',
  testName: 'persists the Esc pause cause for a loaded goal',
  useOpenAIModel: true,
  aimockFixture: 'goal-judge-esc-pause.json',
  prepare: prepareJudgeSettings,
  inProcessApp: startWithHeldJudge,
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit(`/goal ${OBJECTIVE}`);
    await pressEscDuringJudge(terminal, runtime);
    assertPausedByEsc(dbPath);
  },
};
