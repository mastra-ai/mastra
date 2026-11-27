import { execFileSync } from 'node:child_process';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

// Session creation binds the newest project thread; --new must not show it.
const OTHER_THREAD_ID = 'thread-mc-e2e-new-flag-latest';
const OTHER_TITLE = 'E2E latest project thread';
const OTHER_MESSAGE = 'Latest thread fixture message.';

let tui: { getResumeThreadId(): string | null } | undefined;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const newThreadFlagScenario: McE2eScenario = {
  name: 'new-thread-flag',
  description: 'mastracode --new starts a new thread instead of resuming the latest project thread.',
  testName: 'starts a new thread instead of resuming the latest one',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      tui: { startNewThread: true },
      onTuiCreated: created => {
        tui = created as typeof tui;
      },
    });
  },
  prepare({ dbPath, projectDir }) {
    const project = detectProject(projectDir);
    const now = new Date('2026-06-06T15:30:00.000Z').toISOString();
    const metadata = quoteSql(JSON.stringify({ projectPath: project.rootPath }));
    const content = JSON.stringify({ format: 2, parts: [{ type: 'text', text: OTHER_MESSAGE }] });
    execFileSync('sqlite3', [dbPath], {
      input: `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(OTHER_THREAD_ID)}, ${quoteSql(project.resourceId)}, ${quoteSql(OTHER_TITLE)}, ${metadata}, ${quoteSql(now)}, ${quoteSql(now)});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values ('msg-mc-e2e-new-flag-latest', ${quoteSql(OTHER_THREAD_ID)}, ${quoteSql(content)}, 'user', 'v2', ${quoteSql(now)}, ${quoteSql(project.resourceId)});
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
    if (view.includes(OTHER_MESSAGE) || view.includes(OTHER_TITLE)) {
      throw new Error('Expected --new not to render the latest project thread');
    }
    const resumeThreadId = tui?.getResumeThreadId();
    if (resumeThreadId !== null) {
      throw new Error(`Expected no exit resume hint, got thread ${resumeThreadId}`);
    }
    terminal.keyCtrlC();
  },
};
