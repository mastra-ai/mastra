import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function signalContent(signal: {
  id: string;
  contents: string;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  return JSON.stringify({
    format: 2,
    parts: [{ type: 'text', text: signal.contents }],
    metadata: {
      signal: {
        id: signal.id,
        type: 'notification',
        tagName: 'notification',
        createdAt: '2026-06-13T15:30:00.000Z',
        acceptedAt: '2026-06-13T15:30:01.000Z',
        contents: signal.contents,
        attributes: signal.attributes,
        metadata: signal.metadata,
      },
    },
  });
}

export const githubSignalsNotificationReloadScenario: McE2eScenario = {
  name: 'github-signals-notification-reload',
  description: 'Reloads a persisted GitHub notification signal with PR metadata through the real TUI.',
  testName: 'restores GitHub notification cards from loaded history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-13T15:30:00.000Z');
    const resourceId = 'mc-e2e-github-notification-reload-resource';
    const threadId = 'thread-mc-e2e-github-notification-reload';
    const title = 'E2E GitHub notification reload fixture';
    const prLabel = 'mastra-ai/mastra#17641';
    const message = `${prLabel}: CI recovered after GitHub Signals reload fixture.`;
    const metadata = JSON.stringify({
      projectPath: projectDir,
      mastra: {
        githubSignals: {
          subscriptions: [
            {
              owner: 'mastra-ai',
              repo: 'mastra',
              number: 17641,
              subscribedAt: now.toISOString(),
              updatedAt: now.toISOString(),
              lastSyncStatus: 'ok',
              lastObservedCiState: 'success',
              lastNotificationKind: 'pull-request-ci-recovered',
              lastNotificationPriority: 'high',
              lastNotificationSummary: message,
              lastNotificationAt: now.toISOString(),
            },
          ],
        },
      },
    });
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Open the persisted GitHub notification fixture.' }],
    });
    const notification = signalContent({
      id: 'github-notification-reload-signal',
      contents: message,
      attributes: {
        id: 'github-notification-reload-record',
        source: 'github',
        type: 'pull-request-ci-recovered',
        kind: 'pull-request-ci-recovered',
        priority: 'high',
        status: 'seen',
      },
      metadata: {
        notification: {
          signal: 'notification',
          recordId: 'github-notification-reload-record',
          source: 'github',
          kind: 'pull-request-ci-recovered',
          priority: 'high',
          status: 'seen',
          deliveredAt: now.toISOString(),
          title: prLabel,
          url: 'https://github.com/mastra-ai/mastra/pull/17641',
        },
      },
    });

    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-github-notification-reload-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-github-notification-reload-signal', ${quoteSql(threadId)}, ${quoteSql(notification)}, 'signal', 'notification', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E GitHub notification reload fixture/i, terminal, 8_000);
    terminal.write('github notification reload');
    await runtime.waitForScreenText(/E2E GitHub notification reload fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E GitHub notification reload fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/notification from github/i, terminal, 8_000);
    await runtime.waitForScreenText(/high · pull-request-ci-recovered · seen/i, terminal, 8_000);
    await runtime.waitForScreenText(/mastra-ai\/mastra#17641/i, terminal, 8_000);
    await runtime.waitForScreenText(/PR#17641|mastra-ai\/mastra#17641/i, terminal, 8_000);
    await runtime.waitForScreenText(/Open the persisted GitHub notification fixture/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
};
