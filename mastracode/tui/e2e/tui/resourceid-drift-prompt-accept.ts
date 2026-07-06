import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

const OLD_RESOURCE_ID = 'mc-e2e-old-dirname-resource';
const THREAD_ID = 'thread-resource-drift-prompt-accept';
const TITLE = 'Thread from before resource drift';

let scenarioDbPath = '';
let currentResourceId = '';

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
    parts: [{ type: 'text', text: 'Seeded old-resource user message.' }],
  });
  const assistantContent = JSON.stringify({
    format: 2,
    parts: [{ type: 'text', text: 'Ready from old resource.' }],
  });

  const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(THREAD_ID)}, ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql(TITLE)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-drift-accept-user', ${quoteSql(THREAD_ID)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(OLD_RESOURCE_ID)}),
  ('msg-drift-accept-assistant', ${quoteSql(THREAD_ID)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(OLD_RESOURCE_ID)});
`;
  execFileSync('sqlite3', [dbPath], { input: sql });
}

function queryValue(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

export const resourceidDriftPromptAcceptScenario: McE2eScenario = {
  name: 'resourceid-drift-prompt-accept',
  description: 'Prompts before cloning an old-resource thread and resumes the clone when accepted.',
  testName: 'accepts resource drift clone prompt and resumes cloned thread',
  prepare({ dbPath, projectDir }) {
    scenarioDbPath = dbPath;
    seedProject(projectDir);
    currentResourceId = detectProject(projectDir).resourceId;
    seedDriftThread(dbPath, projectDir);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/This directory is tagged on a different resource/i, terminal, 15_000);
    await runtime.waitForScreenText(/Clone and resume/i, terminal, 5_000);
    runtime.printScreen('resource drift prompt', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(
      /Cloning thread into the current resource|Loading cloned thread/i,
      terminal,
      10_000,
    );
    await runtime.waitForScreenText(/Project:/i, terminal, 10_000);

    await runtime.waitForScreenText(/Ready from old resource/i, terminal, 10_000);
    runtime.printScreen('after accepting clone', terminal);

    const oldThreadResourceId = queryValue(
      scenarioDbPath,
      `select resourceId from mastra_threads where id = ${quoteSql(THREAD_ID)};`,
    );
    if (oldThreadResourceId !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old thread to remain on ${OLD_RESOURCE_ID}, got ${oldThreadResourceId}`);
    }

    const clonedThreadId = queryValue(
      scenarioDbPath,
      `select id from mastra_threads where resourceId = ${quoteSql(currentResourceId)} and title = ${quoteSql(TITLE)} and id != ${quoteSql(THREAD_ID)};`,
    );
    if (!clonedThreadId) {
      throw new Error(`Expected cloned thread on ${currentResourceId}`);
    }

    const oldMessageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(THREAD_ID)};`,
    );
    if (oldMessageResourceIds !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old messages to remain on ${OLD_RESOURCE_ID}, got ${oldMessageResourceIds}`);
    }

    const clonedMessageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(clonedThreadId)};`,
    );
    if (clonedMessageResourceIds !== currentResourceId) {
      throw new Error(`Expected cloned message resourceIds ${currentResourceId}, got ${clonedMessageResourceIds}`);
    }

    terminal.keyCtrlC();
  },
};
