import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

const peerId = 'code-agent:mc-e2e-peer-resource:mc-e2e-peer-thread';
const peerThreadId = 'mc-e2e-peer-thread';
const peerResourceId = 'mc-e2e-peer-resource';

type PeerAdvertisement = { unsubscribe: () => void };

let peerAdvertisement: PeerAdvertisement | undefined;
let advertisePeer: (() => Promise<void>) | undefined;
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
    advertisingEnabled = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const app = await startMastraCodeApp({
      onCreated: result => {
        advertisePeer = async () => {
          peerAdvertisement = await (
            result.controller.getMastra()?.getAgentById('code-agent') as unknown as {
              claimThreadOwnership(options: {
                resourceId: string;
                threadId: string;
                peer?: {
                  label?: string;
                  title?: string;
                  metadata?: Record<string, unknown>;
                };
              }): Promise<PeerAdvertisement>;
            }
          )?.claimThreadOwnership({
            resourceId: peerResourceId,
            threadId: peerThreadId,
            peer: {
              label: 'Peer Reviewer',
              title: 'Peer Reviewer',
              metadata: { mode: 'build', projectName: 'Peer Reviewer' },
            },
          });
        };
        timer = setInterval(() => {
          const threadId = result.session.thread.getId();
          if (!advertisingEnabled || peerAdvertisement || !threadId || !result.session.stream.isActive()) return;
          void advertisePeer?.();
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

    terminal.submit('Send a low-priority confirmation signal to the reconnected peer.');
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
    expect(serialized).toContain('[connected]');
    expect(serialized).toContain('[saved]');
    expect(serialized).toContain('No peer agents are discovered or saved.');
    expect(serialized).toContain('connected-agents');
    expect(serialized).not.toContain('[available, available]');
    expect(serialized).not.toContain('"action":"disconnect"');
  },
} satisfies McE2eScenario;
