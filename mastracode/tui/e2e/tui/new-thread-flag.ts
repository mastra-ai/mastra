import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { detectProject } from '@mastra/code-sdk/utils/project';
import { takeNewThreadFlag } from '../../src/resume-command.js';
import type { McE2eScenario } from './types.js';

// Without --new, session creation binds this thread as the newest one for the project.
const SAVED_THREAD_ID = 'thread-mc-e2e-new-flag-latest';
const SAVED_TITLE = 'E2E latest project thread';
const SAVED_MESSAGE = 'Latest thread fixture message.';
const PROMPT = 'Reply with the new thread phrase.';

let tui: { getResumeThreadId(): string | null } | undefined;
let dbPath: string | undefined;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function query(sql: string): string {
  assert.ok(dbPath, 'prepare records the database path');
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

export const newThreadFlagScenario: McE2eScenario = {
  name: 'new-thread-flag',
  description: 'mastracode --new starts a new thread instead of resuming the latest project thread.',
  testName: 'starts a new thread instead of resuming the latest one',
  useOpenAIModel: true,
  aimockFixture: 'new-thread-flag.json',
  inProcessApp({ startMastraCodeApp }) {
    // The same argv handling run-tui.ts does before booting the local session.
    const { startNewThread } = takeNewThreadFlag(['node', 'mastracode', '--new']);
    assert.equal(startNewThread, true);
    return startMastraCodeApp({
      config: { resumeLatestThread: false },
      tui: { startNewThread },
      onTuiCreated: created => {
        tui = created as typeof tui;
      },
    });
  },
  prepare(context) {
    dbPath = context.dbPath;
    const project = detectProject(context.projectDir);
    const now = new Date('2026-06-06T15:30:00.000Z').toISOString();
    const metadata = quoteSql(JSON.stringify({ projectPath: project.rootPath }));
    const content = JSON.stringify({ format: 2, parts: [{ type: 'text', text: SAVED_MESSAGE }] });
    execFileSync('sqlite3', [context.dbPath], {
      input: `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(SAVED_THREAD_ID)}, ${quoteSql(project.resourceId)}, ${quoteSql(SAVED_TITLE)}, ${metadata}, ${quoteSql(now)}, ${quoteSql(now)});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values ('msg-mc-e2e-new-flag-latest', ${quoteSql(SAVED_THREAD_ID)}, ${quoteSql(content)}, 'user', 'v2', ${quoteSql(now)}, ${quoteSql(project.resourceId)});
`,
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal, 15_000);
    runtime.printScreen('new thread startup', terminal);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal, 10_000);
    await runtime.waitForScreenText(/No active thread/i, terminal, 5_000);
    const view = terminal.serialize().view;
    if (view.includes(SAVED_MESSAGE) || view.includes(SAVED_TITLE)) {
      throw new Error('Expected --new not to render the latest project thread');
    }
    if (tui?.getResumeThreadId() !== null) {
      throw new Error(`Expected no exit resume hint, got thread ${tui?.getResumeThreadId()}`);
    }

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(/MC new thread response/, terminal, 15_000);
    const newThreadId = tui?.getResumeThreadId();
    assert.ok(newThreadId, 'the first message creates a thread');
    assert.notEqual(newThreadId, SAVED_THREAD_ID, 'the first message goes to a new thread');
    assert.equal(
      query(`select count(*) from mastra_messages where thread_id = ${quoteSql(SAVED_THREAD_ID)}`),
      '1',
      'the saved thread keeps only its own message',
    );
    assert.equal(query(`select count(*) from mastra_threads where id = ${quoteSql(SAVED_THREAD_ID)}`), '1');
    terminal.keyCtrlC();
  },
};
