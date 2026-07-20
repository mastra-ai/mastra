import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const stateSignalReloadScenario: McE2eScenario = {
  name: 'state-signal-reload',
  description: 'Load persisted state-signal history and verify state signal rendering reconstructs in the real TUI.',
  testName: 'restores state-signal rendering from loaded history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-11T17:00:00.000Z');
    const resourceId = 'mc-e2e-state-signal-reload-resource';
    const threadId = 'thread-mc-e2e-state-signal-reload';
    const title = 'E2E loaded state signal fixture';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const signalMessage = 'Browser state reload e2e delta: active tab changed to https://example.test/reload-state';
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Open the persisted state signal fixture.' }],
    });
    const stateSignalContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: signalMessage }],
      metadata: {
        signal: {
          id: 'state-signal-reload-1',
          type: 'state',
          tagName: 'state',
          createdAt: now.toISOString(),
          attributes: { source: 'mc-e2e-reload' },
          metadata: {
            state: {
              id: 'browser',
              mode: 'delta',
              cacheKey: 'browser:reload:e2e',
              version: 7,
            },
          },
        },
      },
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-state-reload-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('state-signal-reload-1', ${quoteSql(threadId)}, ${quoteSql(stateSignalContent)}, 'signal', 'state', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E loaded state signal fixture/i, terminal, 8_000);
    terminal.write('loaded state signal');
    await runtime.waitForScreenText(/E2E loaded state signal fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E loaded state signal fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/Open the persisted state signal fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/State delta: browser/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /Browser state reload e2e delta: active tab changed to https:\/\/example\.test\/reload-state/i,
      terminal,
      8_000,
    );

    terminal.keyCtrlC();
  },
};
