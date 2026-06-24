import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '../../src/utils/project.js';
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
  description: 'Prompts before migrating an old-resource thread and resumes it when accepted.',
  testName: 'accepts resource drift migration prompt and resumes migrated thread',
  prepare({ dbPath, projectDir }) {
    scenarioDbPath = dbPath;
    seedProject(projectDir);
    currentResourceId = detectProject(projectDir).resourceId;
    seedDriftThread(dbPath, projectDir);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/This directory is tagged on a different resource/i, terminal, 15_000);
    await runtime.waitForScreenText(/Migrate and resume/i, terminal, 5_000);
    runtime.printScreen('resource drift prompt', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Project:/i, terminal, 10_000);

    terminal.submit('/thread');
    await runtime.waitForScreenText(new RegExp(TITLE, 'i'), terminal, 10_000);
    runtime.printScreen('after accepting migration', terminal);

    const threadResourceId = queryValue(scenarioDbPath, `select resourceId from mastra_threads where id = ${quoteSql(THREAD_ID)};`);
    if (threadResourceId !== currentResourceId) {
      throw new Error(`Expected thread resourceId ${currentResourceId}, got ${threadResourceId}`);
    }

    const messageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(THREAD_ID)};`,
    );
    if (messageResourceIds !== currentResourceId) {
      throw new Error(`Expected migrated message resourceIds ${currentResourceId}, got ${messageResourceIds}`);
    }

    terminal.keyCtrlC();
  },
};
