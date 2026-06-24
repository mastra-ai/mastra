import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

export const notificationInboxToolFlowScenario = {
  name: 'notification-inbox-tool-flow',
  description: 'Summarize an active notification, then read it through the real notification_inbox tool.',
  testName: 'reads a summarized notification through notification_inbox and renders the delivered details',
  useOpenAIModel: true,
  aimockFixture: 'notification-inbox-tool-flow.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    let sent = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated: result => {
        timer = setInterval(() => {
          const threadId = result.session.thread.getId();
          if (sent || !threadId || !result.session.stream.isActive()) return;
          sent = true;
          if (timer) clearInterval(timer);
          const agent = result.harness.getMastra()?.getAgentById('code-agent');
          void agent?.sendNotificationSignal(
            {
              source: 'github',
              kind: 'ci-status',
              priority: 'medium',
              summary: 'Notification inbox e2e detail: CI is queued for review',
              dedupeKey: 'mc-e2e-notification-inbox-tool-flow',
            },
            {
              resourceId: result.session.identity.getResourceId(),
              threadId,
              ifIdle: { behavior: 'wake' },
            },
          );
        }, 100);
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

    terminal.submit('Start notification inbox lifecycle host run.');
    await runtime.waitForScreenText(/Notification summary: 1 pending/i, terminal, 10_000);
    await runtime.waitForScreenText(/github: 1/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use notification_inbox to inspect pending notifications/i, terminal, 10_000);
    await runtime.waitForScreenText(/Notification signal follow-up completed/i, terminal, 10_000);
    runtime.printScreen('after notification summary', terminal);

    terminal.submit('Read the pending notification from the inbox.');
    await runtime.waitForScreenText(/notification from github/i, terminal, 15_000);
    await runtime.waitForScreenText(/medium · ci-status · delivered/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox e2e detail: CI is queued for review/i, terminal, 15_000);
    await runtime.waitForScreenText(/Notification inbox read completed/i, terminal, 15_000);
    runtime.printScreen('after notification inbox read', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Start notification inbox lifecycle host run.');
    expect(serialized).toContain('Notification inbox e2e detail: CI is queued for review');
    expect(serialized).toContain('notification_inbox');
    expect(serialized).toContain('Read the pending notification from the inbox.');
  },
} satisfies McE2eScenario;
