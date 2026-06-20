import { execFileSync } from 'node:child_process';

import { detectProject } from '../../src/utils/project.js';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const MESSAGE_COUNT = 3_000;

function padMessageIndex(index: number): string {
  return String(index).padStart(4, '0');
}

export const longThreadStartupHistoryScenario: McE2eScenario = {
  name: 'long-thread-startup-history',
  description: 'Loads a long persisted startup thread and renders the newest bounded history window.',
  testName: 'loads the newest messages from a long startup thread',
  prepare({ dbPath, mastracodeDir, projectDir }) {
    const startedAt = new Date('2026-06-19T15:30:00.000Z');
    const resourceId = detectProject(mastracodeDir).resourceId;
    const threadId = 'thread-mc-e2e-long-startup-history';
    const title = 'E2E long startup history fixture';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const values = Array.from({ length: MESSAGE_COUNT }, (_, offset) => {
      const messageNumber = offset + 1;
      const padded = padMessageIndex(messageNumber);
      const createdAt = new Date(startedAt.getTime() + offset * 1000).toISOString();
      const text = `LONG_THREAD_HISTORY_MESSAGE_${padded}`;
      const content = JSON.stringify({ format: 2, parts: [{ type: 'text', text }] });
      const role = messageNumber % 2 === 0 ? 'assistant' : 'user';
      return `('msg-long-thread-history-${padded}', ${quoteSql(threadId)}, ${quoteSql(content)}, ${quoteSql(role)}, 'v2', ${quoteSql(createdAt)}, ${quoteSql(resourceId)})`;
    }).join(',\n  ');
    const updatedAt = new Date(startedAt.getTime() + (MESSAGE_COUNT - 1) * 1000).toISOString();
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(startedAt.toISOString())}, ${quoteSql(updatedAt)});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ${values};
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal, 8_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E long startup history fixture/i, terminal, 8_000);
    terminal.write('long startup history');
    await runtime.waitForScreenText(/E2E long startup history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E long startup history fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/LONG_THREAD_HISTORY_MESSAGE_3000/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/LONG_THREAD_HISTORY_MESSAGE_0001/i, terminal, 1_000);
    runtime.printScreen('after long startup history load', terminal);
  },
};
