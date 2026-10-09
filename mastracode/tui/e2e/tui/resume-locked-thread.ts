import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

const THREAD_ID = 'thread-mc-e2e-locked-resume';
const TITLE = 'E2E locked resume fixture';
// Session creation binds the newest project thread, so keep the locked one older.
const LATEST_THREAD_ID = 'thread-mc-e2e-unlocked-latest';
const LATEST_TITLE = 'E2E unlocked latest fixture';
const LATEST_MESSAGE = 'Unlocked latest fixture message.';

let tui: { getResumeThreadId(): string | null } | undefined;
let lockPath = '';
let lockOwnerPid = 0;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const resumeLockedThreadScenario: McE2eScenario = {
  name: 'resume-locked-thread',
  description: 'Offers the thread lock choices when the requested resume thread is open in another process.',
  testName: 'prompts instead of crashing when the resume thread is locked',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      tui: { resumeThreadId: THREAD_ID },
      onTuiCreated: created => {
        tui = created as typeof tui;
      },
    });
  },
  prepare({ appDataDir, dbPath, projectDir }) {
    const project = detectProject(projectDir);
    const now = new Date('2026-06-06T14:30:00.000Z').toISOString();
    const later = new Date('2026-06-06T15:30:00.000Z').toISOString();
    const metadata = quoteSql(JSON.stringify({ projectPath: project.rootPath }));
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Locked fixture message.' }] });
    const latestContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: LATEST_MESSAGE }] });
    execFileSync('sqlite3', [dbPath], {
      input: `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values
  (${quoteSql(THREAD_ID)}, ${quoteSql(project.resourceId)}, ${quoteSql(TITLE)}, ${metadata}, ${quoteSql(now)}, ${quoteSql(now)}),
  (${quoteSql(LATEST_THREAD_ID)}, ${quoteSql(project.resourceId)}, ${quoteSql(LATEST_TITLE)}, ${metadata}, ${quoteSql(later)}, ${quoteSql(later)});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-locked-user', ${quoteSql(THREAD_ID)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now)}, ${quoteSql(project.resourceId)}),
  ('msg-mc-e2e-latest-user', ${quoteSql(LATEST_THREAD_ID)}, ${quoteSql(latestContent)}, 'user', 'v2', ${quoteSql(later)}, ${quoteSql(project.resourceId)});
`,
    });

    // A live PID other than the app's own process holds the lock.
    lockOwnerPid = process.ppid;
    const locksDir = join(appDataDir, 'locks');
    mkdirSync(locksDir, { recursive: true });
    lockPath = join(locksDir, `${THREAD_ID}.lock`);
    writeFileSync(lockPath, String(lockOwnerPid));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(
      new RegExp(`Thread "${TITLE}" is locked by pid ${lockOwnerPid}`, 'i'),
      terminal,
      15_000,
    );
    await runtime.waitForScreenText(/New thread/i, terminal, 5_000);
    runtime.printScreen('locked resume prompt', terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenTextAbsent(/is locked by pid/i, terminal, 10_000);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal, 10_000);
    await runtime.waitForScreenText(/No active thread/i, terminal, 5_000);
    runtime.printScreen('after choosing new thread', terminal);
    const view = terminal.serialize().view;
    if (view.includes(LATEST_MESSAGE) || view.includes(LATEST_TITLE)) {
      throw new Error('Expected the auto-selected project thread not to render after a locked resume');
    }
    const resumeThreadId = tui?.getResumeThreadId();
    if (resumeThreadId !== null) {
      throw new Error(`Expected no exit resume hint, got thread ${resumeThreadId}`);
    }

    const lockOwner = readFileSync(lockPath, 'utf8').trim();
    if (lockOwner !== String(lockOwnerPid)) {
      throw new Error(`Expected the other process to keep the lock, found owner ${lockOwner}`);
    }
    terminal.keyCtrlC();
  },
};
