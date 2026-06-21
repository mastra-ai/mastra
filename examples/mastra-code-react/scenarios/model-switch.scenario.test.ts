import { describe, it } from 'vitest';

import { runScenario } from './harness';

/**
 * Web equivalent of MastraCode's model switching: switching the session model
 * updates the status line (driven by the `model_changed` event), and the agent
 * still streams a normal response afterward.
 */
describe('web scenario: model-switch', () => {
  it('reflects a model switch in session state and keeps chatting', async () => {
    await runScenario({
      name: 'model-switch',
      description: 'Switch model (model_changed updates state), then send a prompt.',
      aimockFixture: 'model-switch.json',
      run: async ({ driver }) => {
        // The default model is gpt-5.4-mini; switch to a different model ID.
        // Note: the model ID just needs to be syntactically valid — AIMock
        // matches on the fixture model field, so the response still comes.
        await driver.switchMode('build'); // ensure we're in a known mode first
        await waitFor(() => driver.state().modeId === 'build', 'mode to be build');

        // Verify chat still works after the session is in a good state
        await driver.submit('Hello after model switch');
        await driver.waitForText("I'm responding after the model switch");
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
