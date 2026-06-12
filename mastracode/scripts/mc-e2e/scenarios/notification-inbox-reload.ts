import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function signalContent(signal: {
  id: string;
  tagName: 'notification' | 'notification-summary';
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
        tagName: signal.tagName,
        createdAt: '2026-06-11T18:30:00.000Z',
        acceptedAt: '2026-06-11T18:30:01.000Z',
        contents: signal.contents,
        attributes: signal.attributes,
        metadata: signal.metadata,
      },
    },
  });
}

export const notificationInboxReloadScenario: McE2eScenario = {
  name: 'notification-inbox-reload',
  description: 'Load persisted notification summary and notification signals with statuses through the real TUI.',
  testName: 'restores notification inbox signal rendering from loaded history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-11T18:30:00.000Z');
    const resourceId = 'mc-e2e-notification-reload-resource';
    const threadId = 'thread-mc-e2e-notification-reload';
    const title = 'E2E notification reload fixture';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Open the persisted notification inbox fixture.' }],
    });

    const summary = signalContent({
      id: 'notification-reload-summary-1',
      tagName: 'notification-summary',
      contents: 'linear: 1',
      attributes: { pending: 2, priority: 'high' },
      metadata: {
        notification: {
          signal: 'summary',
          pending: 2,
          groups: [
            { source: 'github', count: 1 },
            { source: 'linear', count: 1 },
          ],
          byPriority: { medium: 1 },
          notificationIds: ['notification-reload-coalesced'],
          priority: 'medium',
        },
        notificationSummary: {
          threadId,
          resourceId,
          agentId: 'code-agent',
          pending: 1,
          bySource: { linear: 1 },
          byPriority: { medium: 1 },
          notificationIds: ['notification-reload-coalesced'],
        },
        notificationIds: ['notification-reload-coalesced'],
      },
    });

    const notificationSignals = [
      {
        id: 'notification-reload-seen-signal',
        recordId: 'notification-reload-seen',
        source: 'calendar',
        kind: 'release-reminder',
        priority: 'medium',
        status: 'seen',
        message: 'Notification reload seen target: release review already opened',
      },
      {
        id: 'notification-reload-dismissed-signal',
        recordId: 'notification-reload-dismissed',
        source: 'linear',
        kind: 'triage-note',
        priority: 'low',
        status: 'dismissed',
        message: 'Notification reload dismissed target: stale triage reminder',
      },
      {
        id: 'notification-reload-archived-signal',
        recordId: 'notification-reload-archived',
        source: 'deploy',
        kind: 'deployment-success',
        priority: 'low',
        status: 'archived',
        message: 'Notification reload archived target: canary completed earlier',
      },
      {
        id: 'notification-reload-coalesced-signal',
        recordId: 'notification-reload-coalesced',
        source: 'linear',
        kind: 'comment-batch',
        priority: 'medium',
        status: 'pending',
        coalescedCount: 3,
        message: 'Notification reload coalesced target: 3 comments collapsed into one record',
      },
    ].map(notification =>
      signalContent({
        id: notification.id,
        tagName: 'notification',
        contents: notification.message,
        attributes: {
          id: notification.recordId,
          source: notification.source,
          type: notification.kind,
          kind: notification.kind,
          priority: notification.priority,
          status: notification.status,
          ...(notification.coalescedCount ? { coalescedCount: notification.coalescedCount } : {}),
        },
        metadata: {
          notification: {
            signal: 'notification',
            recordId: notification.recordId,
            source: notification.source,
            kind: notification.kind,
            priority: notification.priority,
            status: notification.status,
            ...(notification.coalescedCount ? { coalescedCount: notification.coalescedCount } : {}),
            deliveredAt: now.toISOString(),
          },
        },
      }),
    );

    const rows = [...notificationSignals, summary]
      .map(
        (content, index) =>
          `('notification-reload-signal-${index}', ${quoteSql(threadId)}, ${quoteSql(content)}, 'signal', 'notification', ${quoteSql(new Date(now.getTime() + (index + 1) * 1000).toISOString())}, ${quoteSql(resourceId)})`,
      )
      .join(',\n  ');

    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-notification-reload-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ${rows};
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E notification reload fixture/i, terminal, 8_000);
    terminal.write('notification reload');
    await runtime.waitForScreenText(/E2E notification reload fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E notification reload fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/low · triage-note · dismissed/i, terminal, 8_000);
    await runtime.waitForScreenText(/low · deployment-success · archived/i, terminal, 8_000);
    await runtime.waitForScreenText(/medium · comment-batch · pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/Notification reload coalesced target: 3 comments collapsed into one record/i, terminal, 8_000);
    await runtime.waitForScreenText(/Notification summary: 1 pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/linear: 1/i, terminal, 8_000);
    await runtime.waitForScreenText(/Use notification_inbox to inspect pending notifications/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
