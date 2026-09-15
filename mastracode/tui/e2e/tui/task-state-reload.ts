import { execFileSync } from 'node:child_process';
import { TASK_STATE_TYPE } from '@mastra/core/tools';
import type { McE2eScenario } from './types.js';

const threadId = 'thread-mc-e2e-task-state-reload';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const taskStateReloadScenario: McE2eScenario = {
  name: 'task-state-reload',
  description: 'Reopen stored tasks without task history, then reopen an authoritative empty list.',
  testName: 'restores durable tasks and clears them when storage contains an empty list',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-11T17:00:00.000Z').toISOString();
    const tasks = JSON.stringify([
      { id: 'review', content: 'Review saved changes', status: 'in_progress', activeForm: 'Reviewing saved changes' },
      { id: 'publish', content: 'Publish saved changes', status: 'pending', activeForm: 'Publishing saved changes' },
    ]);
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, 'mc-e2e-task-state-reload-resource', 'E2E durable task fixture', ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now)}, ${quoteSql(now)});
insert into mastra_thread_state (threadId, type, value, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(TASK_STATE_TYPE)}, ${quoteSql(tasks)}, ${quoteSql(now)}, ${quoteSql(now)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E durable task fixture/i, terminal);
    terminal.write('durable task fixture');
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E durable task fixture/i, terminal);
    await runtime.waitForScreenText(/Reviewing saved changes/i, terminal);
    await runtime.waitForScreenText(/Publish saved changes/i, terminal);
    runtime.printScreen('restored-durable-tasks', terminal);

    terminal.submit('/new');
    await runtime.waitForScreenTextAbsent(/Reviewing saved changes|Publish saved changes/i, terminal);
    execFileSync('sqlite3', [dbPath], {
      input: `update mastra_thread_state set value = '[]' where threadId = ${quoteSql(threadId)} and type = ${quoteSql(TASK_STATE_TYPE)};`,
    });
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E durable task fixture/i, terminal);
    terminal.write('durable task fixture');
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E durable task fixture/i, terminal);
    await runtime.waitForScreenTextAbsent(/Reviewing saved changes|Publish saved changes/i, terminal);
    runtime.printScreen('restored-empty-tasks', terminal);
    terminal.keyCtrlC();
  },
};
