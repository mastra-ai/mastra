import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const OLD_RESOURCE_ID = 'mc-e2e-old-dirname-resource';
const THREAD_ID = 'thread-resource-drift-prompt-decline';
const TITLE = 'Thread declined from old resource';

let scenarioDbPath = '';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function seedProject(projectDir: string): void {
  mkdirSync(projectDir, { recursive: true });
  gitInDir(['init', '-b', 'main'], projectDir);
  gitInDir(['config', 'user.email', 'mc-e2e@example.com'], projectDir);
  gitInDir(['config', 'user.name', 'MC E2E'], projectDir);
  execFileSync('touch', [join(projectDir, '.gitkeep')]);
  gitInDir(['add', '.gitkeep'], projectDir);
  gitInDir(['commit', '-m', 'init'], projectDir);
  gitInDir(['remote', 'add', 'origin', 'https://github.com/test-org/my-project.git'], projectDir);
}

function seedDriftThread(dbPath: string, projectDir: string): void {
  const now = new Date('2099-01-01T00:00:00.000Z');
  const metadata = JSON.stringify({ projectPath: projectDir });
  const userContent = JSON.stringify({
    format: 2,
    parts: [{ type: 'text', text: 'Seeded old-resource decline user message.' }],
  });

  const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(THREAD_ID)}, ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql(TITLE)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values ('msg-drift-decline-user', ${quoteSql(THREAD_ID)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(OLD_RESOURCE_ID)});
`;
  execFileSync('sqlite3', [dbPath], { input: sql });
}

function queryValue(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

export const resourceidDriftPromptDeclineScenario: McE2eScenario = {
  name: 'resourceid-drift-prompt-decline',
  description: 'Prompts before migrating an old-resource thread and starts fresh when declined.',
  testName: 'declines resource drift migration prompt and leaves old thread untouched',
  prepare({ dbPath, projectDir }) {
    scenarioDbPath = dbPath;
    seedProject(projectDir);
    seedDriftThread(dbPath, projectDir);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/This directory is tagged on a different resource/i, terminal, 15_000);
    await runtime.waitForScreenText(/Start fresh/i, terminal, 5_000);
    runtime.printScreen('resource drift prompt', terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Project:/i, terminal, 10_000);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Title: \(untitled\)/i, terminal, 10_000);
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal, 5_000);
    runtime.printScreen('after declining migration', terminal);

    const oldThreadResourceId = queryValue(
      scenarioDbPath,
      `select resourceId from mastra_threads where id = ${quoteSql(THREAD_ID)};`,
    );
    if (oldThreadResourceId !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old thread to remain on ${OLD_RESOURCE_ID}, got ${oldThreadResourceId}`);
    }

    const messageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(THREAD_ID)};`,
    );
    if (messageResourceIds !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old messages to remain on ${OLD_RESOURCE_ID}, got ${messageResourceIds}`);
    }

    terminal.keyCtrlC();
  },
};
