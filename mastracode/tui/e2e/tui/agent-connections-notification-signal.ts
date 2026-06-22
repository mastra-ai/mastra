import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}

const peers = JSON.stringify([
  {
    id: 'peer-signal-target',
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
  }),
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
    await expect(terminal.getByText(/agent_connections_list ✗|agent_connect .*✗|agent_signal_send .*✗|Failed to list agent connections|Unknown agent peer id/i, { full: true, strict: false })).not.toBeVisible();
    runtime.printScreen('after agent notification signal flow', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(getRequestBodies(requests));
    expect(serialized).toContain('agent_connect');
    expect(serialized).toContain('agent_signal_send');
    expect(serialized).toContain('peer-signal-target');
    expect(serialized).toContain('Agent connection e2e signal: please review the handoff');
  },
} satisfies McE2eScenario;
