import { describe, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's mode switching: switching the session mode
 * updates the status line (driven by the `mode_changed` event), and the agent
 * still streams a normal response afterward.
 */
describe('web scenario: mode-switch', () => {
  it('reflects a mode switch in session state and keeps chatting', async () => {
    await runScenario({
      name: 'mode-switch',
      description: 'Switch to plan mode (mode_changed updates state), then send a prompt.',
      aimockFixture: 'mode-switch.json',
      run: async ({ driver }) => {
        await driver.switchMode('plan');

        // mode_changed flows through the reducer into the status-line state.
        await waitFor(() => driver.state().modeId === 'plan', 'mode to become plan');

        await driver.submit('Outline the plan');
        await driver.waitForText('Switch to build mode');
      },
    });
  });
});

async function waitFor(probe: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!probe()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise(r => setTimeout(r, 25));
  }
}
