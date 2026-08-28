import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const threadHistoryScenario: McE2eScenario = {
  name: 'thread-history',
  description: 'Resume a persisted thread, then fork and rename it through the real TUI.',
  testName: 'supports /resume, /fork, and /rename',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-06T14:30:00.000Z');
    const nowMs = now.getTime();
    const resourceId = 'mc-e2e-seeded-resource';
    const threadId = 'thread-mc-e2e-seeded-history';
    const title = 'E2E seeded history fixture';
    const userText = 'Recovered prior user request from a sanitized fixture.';
    const assistantText = 'Recovered assistant answer from sanitized history.';
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: userText }] });
    const assistantContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: assistantText }] });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-seeded-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-seeded-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(nowMs + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/resume');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    runtime.printScreen('after /resume', terminal);

    terminal.write('seeded history');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E seeded history fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered prior user request from a sanitized fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered assistant answer from sanitized history/i, terminal);
    runtime.printScreen('after seeded thread switch', terminal);

    terminal.submit('/fork');
    await runtime.waitForScreenText(/Fork the current thread\?/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Give the forked thread a name\?/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Forked thread: Clone of E2E seeded history fixture/i, terminal);

    terminal.submit('/rename Forked demo thread');
    await runtime.waitForScreenText(/Thread renamed to: Forked demo thread/i, terminal);
    terminal.submit('/resume');
    await runtime.waitForScreenText(/Forked demo thread/i, terminal);
    terminal.write('\x1b');
    runtime.printScreen('after /fork and /rename', terminal);
  },
};
