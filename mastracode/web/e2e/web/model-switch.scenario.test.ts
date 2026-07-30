import { describe, it } from 'vitest';

import { runScenario } from './scenario-runner';

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
        // Switch the session model and assert the change is reflected in session
        // state (driven by the `model_changed` event). The agent's underlying
        // model stays pointed at AIMock, so the request still matches the fixture
        // — this verifies the model-switch control path, not the LLM backend.
        const before = driver.sessionState().modelId;
        await driver.switchModel('anthropic/claude-sonnet-4');
        await waitFor(
          () => driver.sessionState().modelId === 'anthropic/claude-sonnet-4',
          'session model to update to the switched model',
        );
        if (before === 'anthropic/claude-sonnet-4') {
          throw new Error('model did not change: it was already the target model');
        }

        // Chat still works after switching the model.
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
