import { createOpenAI } from '@ai-sdk/openai';
import { stablePeerId } from '@mastra/code-sdk/agent-connections/registry';
import { createAgentConnectionTools } from '@mastra/code-sdk/agent-connections/tools';
import { Agent } from '@mastra/core/agent';

import { getRequestBodies } from './agent-connections-e2e-utils.js';
import { expect } from './expect.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const requestSummary = 'Abort race request marker: reply after the originating run is interrupted';
const replySummary = 'Abort race reply marker: peer work completed';
const requestMessageId = 'mc-e2e-peer-request-before-origin-abort';
const replyMessageId = 'mc-e2e-peer-reply-during-origin-abort';
const peerResourceId = 'mc-e2e-interrupt-peer-resource';
const peerThreadId = 'mc-e2e-interrupt-peer-thread';

let resolveRequestDelivered: (() => void) | undefined;
let rejectRequestDelivered: ((error: unknown) => void) | undefined;
let requestDelivered = new Promise<void>((resolve, reject) => {
  resolveRequestDelivered = resolve;
  rejectRequestDelivered = reject;
});
let releasePeerReply: (() => void) | undefined;
let peerReplyReleased = new Promise<void>(resolve => {
  releasePeerReply = resolve;
});
let resolveReplyDelivered: (() => void) | undefined;
let rejectReplyDelivered: ((error: unknown) => void) | undefined;
let replyDelivered = new Promise<void>((resolve, reject) => {
  resolveReplyDelivered = resolve;
  rejectReplyDelivered = reject;
});

function resetSignalDelivery(): void {
  requestDelivered = new Promise<void>((resolve, reject) => {
    resolveRequestDelivered = resolve;
    rejectRequestDelivered = reject;
  });
  peerReplyReleased = new Promise<void>(resolve => {
    releasePeerReply = resolve;
  });
  replyDelivered = new Promise<void>((resolve, reject) => {
    resolveReplyDelivered = resolve;
    rejectReplyDelivered = reject;
  });
}

export const notificationSignalInterruptScenario = {
  name: 'notification-signal-interrupt',
  projectFixture: 'long-branch',
  description:
    'Send a peer request during an active TUI run, abort that originating run, and deliver the peer reply during abort cleanup.',
  testName: 'renders a peer reply that arrives while its originating run is being interrupted',
  useOpenAIModel: true,
  aimockFixture: 'notification-signal-interrupt.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    resetSignalDelivery();
    let peerClaim: Awaited<ReturnType<Agent['claimThreadOwnership']>> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let sendStarted = false;

    const app = await startMastraCodeApp({
      config: {
        crossAgentSignals: true,
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated: async result => {
        const mastra = result.controller.getMastra();
        const hostAgent = mastra?.getAgentById('code-agent');
        if (!mastra || !hostAgent) throw new Error('Mastra Code agent was unavailable');

        const peerAgent = new Agent({
          id: 'code-agent',
          name: 'Abort Reply Peer',
          instructions: 'A peer agent used by the Mastra Code E2E harness.',
          model: createOpenAI({
            baseURL: process.env.OPENAI_BASE_URL,
            apiKey: process.env.OPENAI_API_KEY,
          })('gpt-5.4-mini'),
          pubsub: mastra.pubsub,
        });
        mastra.addAgent(peerAgent, 'abort-reply-peer');
        peerClaim = await peerAgent.claimThreadOwnership({
          resourceId: peerResourceId,
          threadId: peerThreadId,
          streamOptions: {},
          peer: { label: 'Abort Reply Peer', title: 'Abort Reply Peer' },
        });

        const hostTools = createAgentConnectionTools({ getAgent: () => hostAgent });
        const peerTools = createAgentConnectionTools({ getAgent: () => peerAgent });
        const peerContext = {
          agent: { agentId: 'code-agent', resourceId: peerResourceId, threadId: peerThreadId },
          mastra,
        } as any;

        timer = setInterval(() => {
          const hostThreadId = result.session.thread.getId();
          if (sendStarted || !hostThreadId || !result.session.stream.isActive()) return;
          sendStarted = true;
          if (timer) clearInterval(timer);

          void (async () => {
            const hostResourceId = result.session.identity.getResourceId();
            const hostPeerId = stablePeerId({
              agentId: 'code-agent',
              resourceId: hostResourceId,
              threadId: hostThreadId,
            });
            const peerId = stablePeerId({
              agentId: 'code-agent',
              resourceId: peerResourceId,
              threadId: peerThreadId,
            });
            const hostContext = {
              agent: { agentId: 'code-agent', resourceId: hostResourceId, threadId: hostThreadId },
              mastra,
            } as any;

            const hostListed = await (hostTools.agent_connections_list as any).execute({}, hostContext);
            if (hostListed.isError || !hostListed.peers.some((peer: { id: string }) => peer.id === peerId)) {
              throw new Error(`Reply peer was not discovered: ${peerId}`);
            }
            const hostConnected = await (hostTools.agent_connect as any).execute({ ids: [peerId] }, hostContext);
            if (hostConnected.isError) throw new Error(hostConnected.content);

            const peerListed = await (peerTools.agent_connections_list as any).execute({}, peerContext);
            if (peerListed.isError || !peerListed.peers.some((peer: { id: string }) => peer.id === hostPeerId)) {
              throw new Error(`Host peer was not discovered: ${hostPeerId}`);
            }
            const peerConnected = await (peerTools.agent_connect as any).execute({ ids: [hostPeerId] }, peerContext);
            if (peerConnected.isError) throw new Error(peerConnected.content);

            const request = await (hostTools.agent_signal_send as any).execute(
              {
                targetId: peerId,
                summary: requestSummary,
                priority: 'low',
                expectsReply: true,
                messageId: requestMessageId,
                payload: { scenario: 'notification-signal-interrupt' },
              },
              hostContext,
            );
            if (request.isError) throw new Error(request.content);
            resolveRequestDelivered?.();

            await peerReplyReleased;
            const reply = await (peerTools.agent_signal_send as any).execute(
              {
                targetId: hostPeerId,
                summary: replySummary,
                priority: 'high',
                expectsReply: false,
                messageId: replyMessageId,
                replyTo: requestMessageId,
                payload: { scenario: 'notification-signal-interrupt' },
              },
              peerContext,
            );
            if (reply.isError) throw new Error(reply.content);
          })().then(
            () => resolveReplyDelivered?.(),
            error => {
              rejectRequestDelivered?.(error);
              rejectReplyDelivered?.(error);
            },
          );
        }, 10);
        timer.unref?.();
      },
    });

    return {
      stop: async () => {
        if (timer) clearInterval(timer);
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

    terminal.write('Start the originating run before the peer reply.');
    await runtime.waitForScreenText(/Start the originating run before the peer reply\./i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Originating run text/i, terminal, 15_000);

    await requestDelivered;
    terminal.keyCtrlC();
    releasePeerReply?.();
    await replyDelivered;
    await runtime.sleep(500);

    await runtime.waitForScreenText(/notification from agent-connection/i, terminal, 10_000);
    await runtime.waitForScreenText(/high · peer-signal · delivered/i, terminal, 10_000);
    await runtime.waitForScreenText(new RegExp(replySummary, 'i'), terminal, 10_000);
    runtime.printScreen('after peer reply during originating-run abort', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('Start the originating run before the peer reply.');
    expect(serialized).toContain(replySummary);
  },
} satisfies McE2eScenario;
