import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const stateSignalRenderingScenario: McE2eScenario = {
  name: 'state-signal-rendering',
  projectFixture: 'long-branch',
  description: 'Emit a real processor-style state signal into an active TUI thread and verify inline rendering.',
  testName: 'renders a live state signal emitted into the active TUI thread',
  useOpenAIModel: true,
  disableMemory: false,
  aimockFixture: 'state-signal-rendering.json',
  async inProcessApp({ startMastraCodeApp }) {
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated(result) {
        let sent = false;
        timer = setInterval(async () => {
          try {
            const threadId = result.harness.getCurrentThreadId();
            if (sent || !threadId || !result.harness.isCurrentThreadStreamActive()) return;
            sent = true;
            if (timer) clearInterval(timer);
            const agent = result.harness.getMastra()?.getAgentById('code-agent');
            await agent?.sendStateSignal(
              {
                id: 'browser',
                cacheKey: 'browser:e2e:v1',
                mode: 'snapshot',
                contents: 'Browser state e2e snapshot: https://example.test/state',
                value: { activeUrl: 'https://example.test/state' },
              },
              {
                resourceId: result.harness.session.identity.getResourceId(),
                threadId,
                ifActive: { attributes: { source: 'mc-e2e' } },
                ifIdle: { behavior: 'persist' },
              },
            );
          } catch (error) {
            process.stderr.write(String(error instanceof Error ? (error.stack ?? error.message) : error) + '\n');
          }
        }, 100);
        timer.unref?.();
      },
    });
    return {
      async stop() {
        if (timer) clearInterval(timer);
        await app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/\[WorkspaceSkills\].*Expected string/i, terminal, 8_000);
    runtime.printScreen('after startup', terminal);

    terminal.write('Start state signal host run.');
    await runtime.waitForScreenText(/Start state signal host run\./i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/State snapshot: browser/i, terminal, 10_000);
    await runtime.waitForScreenText(/Browser state e2e snapshot/i, terminal, 10_000);
    runtime.printScreen('after state signal', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(
      requests.map(request => (request && typeof request === 'object' && 'body' in request ? request.body : undefined)),
    );
    expect(serialized).toContain('Start state signal host run.');
    expect(serialized).toContain('Browser state e2e snapshot: https://example.test/state');
  },
};
