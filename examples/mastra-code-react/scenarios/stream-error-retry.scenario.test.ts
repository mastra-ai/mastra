import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Error recovery: start a run, abort mid-flight (simulating what happens when
 * a model error terminates a run), then retry. This proves the session recovers
 * and is not left stuck — the same user-visible behavior as a model error.
 */
describe('web scenario: stream-error-retry', () => {
  it('recovers after an abort and successfully retries', async () => {
    await runScenario({
      name: 'stream-error-retry',
      description: 'Abort a run (simulating error recovery), then retry successfully.',
      aimockFixture: 'stream-error.json',
      run: async ({ driver }) => {
        // Submit a prompt then abort (simulates run failure).
        await driver.submit('first attempt');
        await driver.abort();
        await driver.waitForIdle();

        // Session should not be stuck.
        expect(driver.state().running).toBe(false);

        // Retry — should succeed normally.
        await driver.submit('retry attempt');
        await driver.waitForText('RECOVERY_RESPONSE after error');

        expect(driver.text()).toContain('RECOVERY_RESPONSE');
      },
    });
  });
});
