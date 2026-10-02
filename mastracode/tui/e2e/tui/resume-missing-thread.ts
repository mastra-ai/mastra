import { execFileSync } from 'node:child_process';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

// Session creation binds the newest project thread; resume must not show it.
const OTHER_THREAD_ID = 'thread-mc-e2e-missing-other';
const OTHER_TITLE = 'E2E other project thread';
const OTHER_MESSAGE = 'Other thread fixture message.';

let tui: { getResumeThreadId(): string | null } | undefined;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const resumeMissingThreadScenario: McE2eScenario = {
  name: 'resume-missing-thread',
  description: 'Starts a new thread with a visible error when the requested resume thread does not exist.',
  testName: 'explains a missing resume thread instead of crashing',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      tui: { resumeThreadId: 'thread-mc-e2e-does-not-exist' },
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
values ('msg-mc-e2e-missing-other', ${quoteSql(OTHER_THREAD_ID)}, ${quoteSql(content)}, 'user', 'v2', ${quoteSql(now)}, ${quoteSql(project.resourceId)});
`,
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Thread not found: thread-mc-e2e-does-not-exist/i, terminal, 15_000);
    await runtime.waitForScreenText(/use \/threads to pick an existing one/i, terminal, 5_000);
    runtime.printScreen('missing resume thread', terminal);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal, 10_000);
    await runtime.waitForScreenText(/No active thread/i, terminal, 5_000);
    const view = terminal.serialize().view;
    if (view.includes(OTHER_MESSAGE) || view.includes(OTHER_TITLE)) {
      throw new Error('Expected the auto-selected project thread not to render after a missing resume');
    }
    const resumeThreadId = tui?.getResumeThreadId();
    if (resumeThreadId !== null) {
      throw new Error(`Expected no exit resume hint, got thread ${resumeThreadId}`);
    }
    terminal.keyCtrlC();
  },
};
