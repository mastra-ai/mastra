import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { getRequestBodies } from './agent-connections-e2e-utils.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const peerId = 'code-agent:mc-e2e-signal-peer-resource:mc-e2e-signal-peer-thread';

const peers = JSON.stringify([
  {
    id: peerId,
    resourceId: 'mc-e2e-signal-peer-resource',
    threadId: 'mc-e2e-signal-peer-thread',
    label: 'Signal Target Peer',
    mode: 'build',
  },
]);

export const agentConnectionsNotificationSignalScenario = {
  name: 'agent-connections-notification-signal',
  description: 'Connect to a peer agent and send it a prioritized notification signal.',
  testName: 'sends a prioritized notification signal through the connected-agent tool',
  useOpenAIModel: true,
  aimockFixture: 'agent-connections-notification-signal.json',
  env: () => ({
    MASTRACODE_AGENT_CONNECTION_PEERS: peers,
    MASTRACODE_ENABLE_CROSS_AGENT_SIGNALS: '1',
  }),
  async inProcessApp({ startMastraCodeApp }) {
    let peerClaim: Awaited<ReturnType<Agent['claimThreadOwnership']>> | undefined;
    let claimPromise: Promise<void> | undefined;
    const app = await startMastraCodeApp({
      config: { crossAgentSignals: true, unixSocketPubSub: false },
      onCreated: result => {
        claimPromise = (async () => {
          const mastra = result.controller.getMastra();
          const agent = mastra?.getAgentById('code-agent');
          if (!mastra || !agent) return;
          const peerAgent = new Agent({
            id: 'code-agent',
            name: 'Signal Target Peer',
            instructions: 'A peer agent used by the Mastra Code E2E harness.',
            model: createOpenAI({
              baseURL: process.env.OPENAI_BASE_URL,
              apiKey: process.env.OPENAI_API_KEY,
            })('gpt-5.4-mini'),
            pubsub: mastra.pubsub,
          });
          peerClaim = await peerAgent.claimThreadOwnership({
            resourceId: 'mc-e2e-signal-peer-resource',
            threadId: 'mc-e2e-signal-peer-thread',
            streamOptions: {},
          });
        })();
      },
    });
    try {
      await claimPromise;
    } catch (error) {
      await app.stop?.();
      throw error;
    }
    return {
      stop: async () => {
        peerClaim?.unsubscribe();
        await app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Connect to the signal target and send a high priority peer signal.');
    await runtime.waitForScreenText(/agent_connections_list ✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/agent_connect .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/agent_signal_send .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/Agent notification signal flow completed/i, terminal, 20_000);
    await expect(
      terminal.getByText(
        /agent_connections_list ✗|agent_connect .*✗|agent_signal_send .*✗|Failed to list agent connections|Unknown agent peer id/i,
        { full: true, strict: false },
      ),
    ).not.toBeVisible();
    runtime.printScreen('after agent notification signal flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('agent_connect');
    expect(serialized).toContain('agent_signal_send');
    expect(serialized).toContain(peerId);
    expect(serialized).toContain('Agent connection e2e signal: please review the handoff');
  },
} satisfies McE2eScenario;
