import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const peerId = 'code-agent:mc-e2e-expected-reply-peer-resource:mc-e2e-expected-reply-peer-thread';
const messageId = 'expected-reply-request';
const peerSummary = 'Expected reply watchdog e2e: choose whether to acknowledge this peer update';
function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

let shouldSendExpectedReplySignal = false;

const peers = JSON.stringify([
  {
    id: peerId,
    resourceId: 'mc-e2e-expected-reply-peer-resource',
    threadId: 'mc-e2e-expected-reply-peer-thread',
    label: 'Expected Reply Peer',
    mode: 'build',
  },
]);

export const agentConnectionsExpectedReplyWatchdogScenario = {
  name: 'agent-connections-expected-reply-watchdog',
  description:
    'Inject an expected-reply peer signal and verify the watchdog retries a model response that forgot to reply.',
  testName: 'retries and sends a peer signal when an expected-reply notification would otherwise go unanswered',
  useOpenAIModel: true,
  aimockFixture: 'agent-connections-expected-reply-watchdog.json',
  env: () => ({
    MASTRACODE_AGENT_CONNECTION_PEERS: peers,
  }),
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    shouldSendExpectedReplySignal = false;
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
          if (sent || !shouldSendExpectedReplySignal || !threadId || !result.session.stream.isActive()) return;
          sent = true;
          if (timer) clearInterval(timer);
          const agent = result.controller.getMastra()?.getAgentById('code-agent');
          void agent?.sendNotificationSignal(
            {
              source: 'agent-connection',
              kind: 'peer-signal',
              priority: 'urgent',
              summary: peerSummary,
              dedupeKey: 'mc-e2e-agent-connections-expected-reply-watchdog',
              attributes: { expectsReply: true, messageId, returnPeerId: peerId },
              metadata: {
                crossAgentMessaging: {
                  expectsReply: true,
                  messageId,
                  returnPeerId: peerId,
                  from: {
                    resourceId: 'mc-e2e-expected-reply-peer-resource',
                    threadId: 'mc-e2e-expected-reply-peer-thread',
                  },
                },
              },
            },
            {
              resourceId: result.session.identity.getResourceId(),
              threadId,
              ifIdle: { behavior: 'wake' },
            },
          );
        }, 50);
        timer.unref?.();
      },
    });

    return {
      stop: async () => {
        shouldSendExpectedReplySignal = false;
        if (timer) clearInterval(timer);
        await app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Connect to the expected reply peer.');
    await runtime.waitForScreenText(/agent_connections_list ✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/agent_connect .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/Expected reply peer connected/i, terminal, 20_000);

    // The notification is sent during the active stream (when the user submits the next prompt).
    // The model "forgets" to reply, the watchdog injects an expected-reply-reminder and retries,
    // then the model sends the reply.
    shouldSendExpectedReplySignal = true;
    terminal.submit('Process any pending notifications.');
    await runtime.waitForScreenText(/expected-reply-reminder/i, terminal, 30_000);
    await runtime.waitForScreenText(/agent_signal_send .*✓/i, terminal, 30_000);
    await runtime.waitForScreenText(/Expected reply watchdog completed/i, terminal, 30_000);
    await expect(
      terminal.getByText(
        /agent_signal_send .*✗|Cannot send: peer is not saved|Cannot send: saved peer is not currently advertised/i,
        {
          full: true,
          strict: false,
        },
      ),
    ).not.toBeVisible();
    runtime.printScreen('after expected-reply watchdog flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain(peerSummary);
    expect(serialized).toContain('expected-reply-reminder');
    expect(serialized).toContain('agent_signal_send');
    expect(serialized).toContain(peerId);
  },
} satisfies McE2eScenario;
