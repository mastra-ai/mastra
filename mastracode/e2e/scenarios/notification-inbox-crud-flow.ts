import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

export const notificationInboxCrudFlowScenario = {
  name: 'notification-inbox-crud-flow',
  description: 'Exercise notification_inbox list, markSeen, dismiss, archive, and search through the real TUI.',
  testName: 'manages seeded notification inbox records through CRUD and search actions',
  useOpenAIModel: true,
  aimockFixture: 'notification-inbox-crud-flow.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    let seeded = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated: result => {
        const seedNotifications = async () => {
          const threadId = result.session.thread.getId();
          if (seeded || !threadId || !result.session.stream.isActive()) return;
          seeded = true;
          if (timer) clearInterval(timer);
          const storage = await result.harness.getMastra()?.getStorage()?.getStore('notifications');
          if (!storage) throw new Error('notification storage unavailable');
          const resourceId = result.session.identity.getResourceId();
          const agentId = 'code-agent';
          await storage.createNotification({
            id: 'inbox-crud-seen',
            threadId,
            resourceId,
            agentId,
            source: 'github',
            kind: 'ci-status',
            priority: 'medium',
            summary: 'Notification CRUD markSeen target: flaky CI warning',
          });
          await storage.createNotification({
            id: 'inbox-crud-dismiss',
            threadId,
            resourceId,
            agentId,
            source: 'github',
            kind: 'review-comment',
            priority: 'high',
            summary: 'Notification CRUD dismiss target: reviewer requested docs',
          });
          await storage.createNotification({
            id: 'inbox-crud-archive',
            threadId,
            resourceId,
            agentId,
            source: 'deploy',
            kind: 'deployment-success',
            priority: 'low',
            summary: 'Notification CRUD archive target: canary deployed',
          });
          await storage.createNotification({
            id: 'inbox-crud-search',
            threadId,
            resourceId,
            agentId,
            source: 'calendar',
            kind: 'release-reminder',
            priority: 'medium',
            summary: 'Notification CRUD search control: roadmap planning reminder',
          });
          await storage.createNotification({
            id: 'inbox-crud-list-only',
            threadId,
            resourceId,
            agentId,
            source: 'linear',
            kind: 'triage-note',
            priority: 'medium',
            summary: 'Notification CRUD list-only target: triage queue visible',
          });
        };

        timer = setInterval(() => {
          void seedNotifications().catch(error => {
            if (timer) clearInterval(timer);
            process.stderr.write(String(error instanceof Error ? (error.stack ?? error.message) : error) + '\n');
          });
        }, 50);
        timer.unref?.();
      },
    });

    return {
      stop: async () => {
        if (timer) clearInterval(timer);
        await app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as ReturnType<
        typeof expect
      >
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Seed notification inbox CRUD fixtures.');
    await runtime.waitForScreenText(/Notification inbox CRUD seed ready/i, terminal, 10_000);
    runtime.printScreen('after seed turn', terminal);

    terminal.submit('Exercise notification inbox CRUD and search.');
    await runtime.waitForOutputText(/"status": "seen"/i, terminal, 15_000);
    await runtime.waitForOutputText(/"status": "dismissed"/i, terminal, 15_000);
    await runtime.waitForOutputText(/"status": "archived"/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox CRUD\/search e2e complete/i, terminal, 15_000);
    runtime.printScreen('after notification inbox crud flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Seed notification inbox CRUD fixtures.');
    expect(serialized).toContain('Exercise notification inbox CRUD and search.');
    expect(serialized).toContain('call_notification_crud_list');
    expect(serialized).toContain('call_notification_crud_search_seen');
    expect(serialized).toContain('call_notification_crud_search_dismissed');
    expect(serialized).toContain('call_notification_crud_search_archived');
    expect(serialized).toContain('inbox-crud-seen');
    expect(serialized).toContain('inbox-crud-dismiss');
    expect(serialized).toContain('inbox-crud-archive');
    expect(serialized).toContain('flaky');
    expect(serialized).toContain('reviewer');
    expect(serialized).toContain('canary');
  },
} satisfies McE2eScenario;
