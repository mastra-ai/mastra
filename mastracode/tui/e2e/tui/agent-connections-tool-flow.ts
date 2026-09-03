import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { getRequestBodies } from './agent-connections-e2e-utils.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const peerId = 'code-agent:mc-e2e-peer-resource:mc-e2e-peer-thread';
const peerThreadId = 'mc-e2e-peer-thread';
const peerResourceId = 'mc-e2e-peer-resource';

type PeerAdvertisement = { unsubscribe: () => void };

let peerAdvertisement: PeerAdvertisement | undefined;
let advertisePeer: (() => Promise<void>) | undefined;
let advertisePeerInFlight: Promise<void> | undefined;
let advertisingEnabled = true;

export const agentConnectionsToolFlowScenario = {
  name: 'agent-connections-tool-flow',
  description: 'Discover, connect, disconnect while absent, reconnect, and signal a peer through real tools.',
  testName: 'disconnects an absent saved peer and restores send eligibility after reconnecting',
  useOpenAIModel: true,
  aimockFixture: 'agent-connections-tool-flow.json',
  async inProcessApp({ startMastraCodeApp }) {
    peerAdvertisement = undefined;
    advertisePeer = undefined;
    advertisePeerInFlight = undefined;
    advertisingEnabled = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      config: {
        crossAgentSignals: true,
      },
      onCreated: result => {
        let peerAgent: Agent | undefined;
        advertisePeer = async () => {
          if (peerAdvertisement) return;
          // Share one in-flight claim so every caller awaits the same publish.
          advertisePeerInFlight ??= (async () => {
            try {
              const mastra = result.controller.getMastra();
              const agent = mastra?.getAgentById('code-agent');
              if (!mastra || !agent) return;
              peerAgent ??= new Agent({
                id: 'code-agent',
                name: 'Peer Reviewer',
                instructions: 'A peer agent used by the Mastra Code E2E harness.',
                model: createOpenAI({
                  baseURL: process.env.OPENAI_BASE_URL,
                  apiKey: process.env.OPENAI_API_KEY,
                })('gpt-5.4-mini'),
                pubsub: mastra.pubsub,
              });
              peerAdvertisement = await peerAgent.claimThreadOwnership({
                resourceId: peerResourceId,
                threadId: peerThreadId,
                streamOptions: {},
                peer: {
                  label: 'Peer Reviewer',
                  title: 'Peer Reviewer',
                  metadata: { mode: 'build', projectName: 'Peer Reviewer' },
                },
              });
            } finally {
              advertisePeerInFlight = undefined;
            }
          })();
          await advertisePeerInFlight;
        };
        timer = setInterval(() => {
          const threadId = result.session.thread.getId();
          if (
            !advertisingEnabled ||
            peerAdvertisement ||
            advertisePeerInFlight ||
            !threadId ||
            !result.session.stream.isActive()
          ) {
            return;
          }
          void advertisePeer?.().catch(() => {});
        }, 25);
      },
    });
    return {
      stop: async () => {
        if (timer) clearInterval(timer);
        peerAdvertisement?.unsubscribe();
        await app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    runtime.printScreen('after startup', terminal);

    // Ensure the peer claim is published before the first discovery request so
    // agent_connect cannot race an unadvertised peer id. The interval remains
    // as a safety net for re-advertisement.
    await advertisePeer?.();
    terminal.submit('Connect to the peer reviewer agent.');
    await runtime.waitForScreenText(/agent_connections_list ✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/agent_connect .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/Initial agent connection completed/i, terminal, 20_000);

    advertisingEnabled = false;
    peerAdvertisement?.unsubscribe();
    peerAdvertisement = undefined;
    terminal.submit('Confirm the saved peer is no longer advertised.');
    await runtime.waitForScreenText(/Confirmed the absent peer is saved/i, terminal, 20_000);

    terminal.submit('Disconnect the absent saved peer.');
    await runtime.waitForScreenText(/agent_disconnect .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/Absent saved peer disconnected/i, terminal, 20_000);

    terminal.submit('List peers after disconnecting the absent peer.');
    await runtime.waitForScreenText(/Disconnected absent peer is omitted/i, terminal, 20_000);

    await advertisePeer?.();
    advertisingEnabled = true;
    terminal.submit('Reconnect to the peer reviewer agent.');
    await runtime.waitForScreenText(/Peer reviewer reconnected/i, terminal, 20_000);

    terminal.submit('Send a high-priority confirmation signal to the reconnected peer.');
    await runtime.waitForScreenText(/agent_signal_send .*✓/i, terminal, 20_000);
    await runtime.waitForScreenText(/Agent connection tool flow completed after disconnect/i, terminal, 20_000);
    await expect(
      terminal.getByText(
        /agent_connections_list ✗|agent_connect .*✗|agent_disconnect .*✗|agent_signal_send .*✗|Failed to (list|connect|disconnect|send)/i,
        { full: true, strict: false },
      ),
    ).not.toBeVisible();
    runtime.printScreen('after agent connection flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('agent_connections_list');
    expect(serialized).toContain('agent_connect');
    expect(serialized).toContain('agent_disconnect');
    expect(serialized).toContain('agent_signal_send');
    expect(serialized).toContain(peerId);
    expect(serialized).toContain('[discovered]');
    // The connect delta reaches the model through the connected-agents state
    // signal; released advertisements no longer answer discovery, so a list
    // never deterministically shows [connected].
    expect(serialized).toMatch(/displayStatus\\?":\\?"connected/);
    expect(serialized).toContain('[saved]');
    expect(serialized).toContain('No peer agents are discovered or saved.');
    expect(serialized).toContain('connected-agents');
    expect(serialized).not.toContain('[available, available]');
    expect(serialized).not.toContain('"action":"disconnect"');
  },
} satisfies McE2eScenario;
