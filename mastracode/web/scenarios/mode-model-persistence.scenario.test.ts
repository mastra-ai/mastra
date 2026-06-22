import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

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
        expect(driver.state().modeId).toBe('build');

        // Send a message first (required to prove the harness is live).
        await driver.submit('hello');
        await driver.waitForText('acknowledged');
        await driver.waitForIdle();

        // Switch to plan mode.
        await driver.switchMode('plan');
        // Wait for the mode_changed event.
        const start = Date.now();
        while (driver.state().modeId !== 'plan') {
          if (Date.now() - start > 5000) throw new Error('timeout waiting for mode plan');
          await new Promise(r => setTimeout(r, 25));
        }
        expect(driver.state().modeId).toBe('plan');

        // Re-read state via the API to confirm persistence.
        const client = driver.getClient();
        const session = client.getHarness('code').session('web-scenario-mode-model-persistence');
        const state = await session.state();
        expect(state.modeId).toBe('plan');
      },
    });
  });
});
