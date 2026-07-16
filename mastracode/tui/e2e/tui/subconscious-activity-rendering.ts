import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const REPLAY_TITLE = 'E2E Subconscious activity replay';

function activitySnapshot(name: string) {
  return {
    updates: [
      {
        id: `activity-${name.toLowerCase().replaceAll(' ', '-')}`,
        action: 'fact-created',
        type: 'fact',
        recordId: `fact-${name.toLowerCase().replaceAll(' ', '-')}`,
        name,
        targetId: `entity-${name.toLowerCase().replaceAll(' ', '-')}`,
        targetType: 'entity',
        sourceThreadId: 'source-thread',
        createdAt: '2026-07-15T20:00:00.000Z',
      },
    ],
    hot: [{ type: 'entity', id: `entity-${name.toLowerCase().replaceAll(' ', '-')}`, name, updates: 1 }],
  };
}

export const subconsciousActivityRenderingScenario: McE2eScenario = {
  name: 'subconscious-activity-rendering',
  projectFixture: 'long-branch',
  description: 'Render live and replayed structured Subconscious knowledge activity through the real TUI.',
  testName: 'renders live and replayed Subconscious knowledge activity',
  useOpenAIModel: true,
  disableMemory: false,
  aimockFixture: 'subconscious-activity-rendering.json',
  async inProcessApp({ startMastraCodeApp }) {
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
      async onCreated(result) {
        const replayThread = await result.session.thread.create({ title: REPLAY_TITLE });
        const agent = result.controller.getMastra()?.getAgentById('code-agent');
        await agent?.sendStateSignal(
          {
            id: 'subconscious-activity',
            cacheKey: 'subconscious-activity:replay:v1',
            mode: 'snapshot',
            contents: 'Subconscious replay activity for Beta service.',
            value: activitySnapshot('Beta service'),
          },
          {
            resourceId: result.session.identity.getResourceId(),
            threadId: replayThread.id,
            ifIdle: { behavior: 'persist' },
          },
        );
        const liveThread = await result.session.thread.create({ title: 'E2E Subconscious activity live' });

        let sent = false;
        timer = setInterval(async () => {
          if (sent || !result.session.stream.isActive() || result.session.thread.getId() !== liveThread.id) return;
          sent = true;
          if (timer) clearInterval(timer);
          await agent?.sendStateSignal(
            {
              id: 'subconscious-activity',
              cacheKey: 'subconscious-activity:live:v1',
              mode: 'snapshot',
              contents: 'Subconscious live activity for Atlas launch.',
              value: activitySnapshot('Atlas launch'),
            },
            {
              resourceId: result.session.identity.getResourceId(),
              threadId: liveThread.id,
              ifActive: { attributes: { source: 'mc-e2e' } },
              ifIdle: { behavior: 'persist' },
            },
          );
        }, 100);
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
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.write('Start state signal host run.');
    terminal.write('\r');
    await runtime.waitForScreenText(/Subconscious knowledge/i, terminal, 10_000);
    await runtime.waitForScreenText(/fact-created: Atlas launch/i, terminal, 10_000);
    await runtime.waitForScreenText(/Hot: Atlas launch \(1\)/i, terminal, 10_000);
    runtime.printScreen('live Subconscious activity', terminal);

    terminal.keyCtrlC();
    terminal.submit('/threads');
    await runtime.waitForScreenText(new RegExp(REPLAY_TITLE, 'i'), terminal);
    terminal.write('Subconscious activity replay');
    terminal.write('\r');
    await runtime.waitForScreenText(new RegExp(`Switched to: ${REPLAY_TITLE}`, 'i'), terminal);
    await runtime.waitForScreenText(/Subconscious knowledge/i, terminal, 8_000);
    await runtime.waitForScreenText(/fact-created: Beta service/i, terminal, 8_000);
    await runtime.waitForScreenText(/Hot: Beta service \(1\)/i, terminal, 8_000);
    runtime.printScreen('replayed Subconscious activity', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    expect(serialized).toContain('Start state signal host run.');
    expect(serialized).toContain('Subconscious live activity for Atlas launch.');
  },
};
