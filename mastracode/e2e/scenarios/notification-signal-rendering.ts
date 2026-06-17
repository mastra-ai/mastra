import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

export const notificationSignalRenderingScenario = {
  name: 'notification-signal-rendering',
  projectFixture: 'long-branch',
  description: 'Emit a real notification signal into an active TUI thread and verify inline notification rendering.',
  testName: 'renders a live notification signal emitted into the active TUI thread',
  useOpenAIModel: true,
  aimockFixture: 'notification-signal-rendering.json',
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
          const threadId = result.harness.getCurrentThreadId();
          if (sent || !threadId || !result.harness.isCurrentThreadStreamActive()) return;
          sent = true;
          if (timer) clearInterval(timer);
          const agent = result.harness.getMastra()?.getAgentById('code-agent');
          void agent?.sendNotificationSignal(
            {
              source: 'github',
              kind: 'ci-status',
              priority: 'urgent',
              summary: 'Notification e2e alert: CI failed on main',
              dedupeKey: 'mc-e2e-notification-signal',
            },
            {
              resourceId: result.harness.getResourceId(),
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
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/\[WorkspaceSkills\].*Expected string/i, terminal, 8_000);
    runtime.printScreen('after startup', terminal);

    terminal.write('Start notification host run.');
    await runtime.waitForScreenText(/Start notification host run\./i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/notification from github/i, terminal, 10_000);
    await runtime.waitForScreenText(/urgent · ci-status · delivered/i, terminal, 10_000);
    await runtime.waitForScreenText(/Notification e2e alert: CI failed on main/i, terminal, 10_000);
    runtime.printScreen('after notification signal', terminal);
    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Start notification host run.');
    expect(serialized).toContain('Notification e2e alert: CI failed on main');
  },
} satisfies McE2eScenario;
