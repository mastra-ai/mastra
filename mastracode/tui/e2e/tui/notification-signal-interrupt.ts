import { createOpenAI } from '@ai-sdk/openai';
import { stablePeerId } from '@mastra/code-sdk/agent-connections/registry';
import { createAgentConnectionTools } from '@mastra/code-sdk/agent-connections/tools';
import { Agent } from '@mastra/core/agent';

import { getRequestBodies } from './agent-connections-e2e-utils.js';
import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const notificationSummary = 'Interrupt race notification marker: peer work completed';
const messageId = 'mc-e2e-real-peer-notification-interrupt';
const peerResourceId = 'mc-e2e-interrupt-sender-resource';
const peerThreadId = 'mc-e2e-interrupt-sender-thread';

let resolveNotificationDelivered: (() => void) | undefined;
let rejectNotificationDelivered: ((error: unknown) => void) | undefined;
let notificationDelivered = new Promise<void>((resolve, reject) => {
  resolveNotificationDelivered = resolve;
  rejectNotificationDelivered = reject;
});
let resolveNotificationReceived: (() => void) | undefined;
let notificationReceived = new Promise<void>(resolve => {
  resolveNotificationReceived = resolve;
});
let resolveWakeResponseStarted: (() => void) | undefined;
let wakeResponseStarted = new Promise<void>(resolve => {
  resolveWakeResponseStarted = resolve;
});

function resetNotificationDelivery(): void {
  notificationDelivered = new Promise<void>((resolve, reject) => {
    resolveNotificationDelivered = resolve;
    rejectNotificationDelivered = reject;
  });
  notificationReceived = new Promise<void>(resolve => {
    resolveNotificationReceived = resolve;
  });
  wakeResponseStarted = new Promise<void>(resolve => {
    resolveWakeResponseStarted = resolve;
  });
}

export const notificationSignalInterruptScenario = {
  name: 'notification-signal-interrupt',
  projectFixture: 'long-branch',
  description:
    'Send a real peer signal to an idle TUI thread, interrupt its wake run, and verify the card remains visible.',
  testName: 'keeps a real peer notification visible when its wake run is interrupted',
  useOpenAIModel: true,
  aimockFixture: 'notification-signal-interrupt.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    resetNotificationDelivery();
    let peerClaim: Awaited<ReturnType<Agent['claimThreadOwnership']>> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let sawActiveRun = false;
    let sendStarted = false;
    let unsubscribeSession: (() => void) | undefined;

    const app = await startMastraCodeApp({
      config: {
        crossAgentSignals: true,
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated: async result => {
        const mastra = result.controller.getMastra();
        if (!mastra) throw new Error('Mastra was unavailable');

        const peerAgent = new Agent({
          id: 'code-agent',
          name: 'Interrupt Sender Peer',
          instructions: 'A peer agent used by the Mastra Code E2E harness.',
          model: createOpenAI({
            baseURL: process.env.OPENAI_BASE_URL,
            apiKey: process.env.OPENAI_API_KEY,
          })('gpt-5.4-mini'),
          pubsub: mastra.pubsub,
        });
        mastra.addAgent(peerAgent, 'interrupt-sender-peer');
        peerClaim = await peerAgent.claimThreadOwnership({
          resourceId: peerResourceId,
          threadId: peerThreadId,
          streamOptions: {},
          peer: { label: 'Interrupt Sender Peer', title: 'Interrupt Sender Peer' },
        });

        let receivedNotification = false;
        unsubscribeSession = result.session.subscribe(event => {
          if (event.type !== 'message_start' || typeof event.message === 'string') return;
          if (event.message.role === 'signal' && JSON.stringify(event.message.content).includes(notificationSummary)) {
            receivedNotification = true;
            resolveNotificationReceived?.();
          } else if (receivedNotification && event.message.role === 'assistant') {
            resolveWakeResponseStarted?.();
          }
        });

        const tools = createAgentConnectionTools({ getAgent: () => peerAgent });
        const context = {
          agent: { agentId: 'code-agent', resourceId: peerResourceId, threadId: peerThreadId },
          mastra,
        } as any;

        timer = setInterval(() => {
          const receiverThreadId = result.session.thread.getId();
          if (result.session.stream.isActive()) {
            sawActiveRun = true;
            return;
          }
          if (sendStarted || !receiverThreadId || !sawActiveRun) return;
          sendStarted = true;
          if (timer) clearInterval(timer);

          void (async () => {
            const receiverPeerId = stablePeerId({
              agentId: 'code-agent',
              resourceId: result.session.identity.getResourceId(),
              threadId: receiverThreadId,
            });
            const listed = await (tools.agent_connections_list as any).execute({}, context);
            if (listed.isError || !listed.peers.some((peer: { id: string }) => peer.id === receiverPeerId)) {
              throw new Error(`Receiver peer was not discovered: ${receiverPeerId}`);
            }
            const connected = await (tools.agent_connect as any).execute({ ids: [receiverPeerId] }, context);
            if (connected.isError) throw new Error(connected.content);
            const sent = await (tools.agent_signal_send as any).execute(
              {
                targetId: receiverPeerId,
                summary: notificationSummary,
                priority: 'high',
                expectsReply: false,
                messageId,
                payload: { scenario: 'notification-signal-interrupt' },
              },
              context,
            );
            if (sent.isError) throw new Error(sent.content);
          })().then(() => resolveNotificationDelivered?.(), rejectNotificationDelivered);
        }, 10);
        timer.unref?.();
      },
    });

    return {
      stop: async () => {
        if (timer) clearInterval(timer);
        unsubscribeSession?.();
        peerClaim?.unsubscribe();
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

    terminal.write('Start notification interrupt host run.');
    await runtime.waitForScreenText(/Start notification interrupt host run\./i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Initial interrupt host text/i, terminal, 15_000);

    await notificationDelivered;
    await notificationReceived;
    await wakeResponseStarted;
    terminal.keyCtrlC();
    await terminal.flushInput?.();

    await runtime.waitForScreenText(/notification from agent-connection/i, terminal, 10_000);
    await runtime.waitForScreenText(/high · peer-signal · delivered/i, terminal, 10_000);
    await runtime.waitForScreenText(new RegExp(notificationSummary, 'i'), terminal, 10_000);
    runtime.printScreen('after real peer notification interrupt race', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Start notification interrupt host run.');
    expect(serialized).toContain(notificationSummary);
  },
} satisfies McE2eScenario;
