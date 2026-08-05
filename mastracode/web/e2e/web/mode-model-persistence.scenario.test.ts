import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Switch mode and model, then re-fetch session state to verify the switches
 * persisted. This mirrors MastraCode's `models-pack-activation-persistence`
 * and `settings-startup-model-restore` scenarios.
 */
describe('web scenario: mode-model-persistence', () => {
  it('persists mode and model switches', async () => {
    await runScenario({
      name: 'mode-model-persistence',
      description: 'Switch mode and model, verify they persist on re-read.',
      aimockFixture: 'mode-model-persistence.json',
      run: async ({ driver }) => {
        // Default mode should be 'build'.
        expect(driver.sessionState().modeId).toBe('build');

        // Send a message first (required to prove the controller is live).
        await driver.submit('hello');
        await driver.waitForText('acknowledged');
        await driver.waitForIdle();

        // Switch both mode and model.
        await driver.switchMode('plan');
        await driver.switchModel('anthropic/claude-sonnet-4');

        // Wait for the mode_changed + model_changed events to land.
        const start = Date.now();
        while (
          driver.sessionState().modeId !== 'plan' ||
          driver.sessionState().modelId !== 'anthropic/claude-sonnet-4'
        ) {
          if (Date.now() - start > 5000) throw new Error('timeout waiting for mode/model to update');
          await new Promise(r => setTimeout(r, 25));
        }
        expect(driver.sessionState().modeId).toBe('plan');
        expect(driver.sessionState().modelId).toBe('anthropic/claude-sonnet-4');

        // Re-read state via the API to confirm BOTH switches persisted.
        const client = driver.getClient();
        const session = client.getAgentController('code').session('web-scenario-mode-model-persistence');
        const state = await session.state();
        expect(state.modeId).toBe('plan');
        expect(state.modelId).toBe('anthropic/claude-sonnet-4');
      },
    });
  });
});
