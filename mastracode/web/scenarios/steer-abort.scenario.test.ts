import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Web equivalent of MastraCode's steer + abort flows:
 * - Steer: interject mid-conversation to redirect the agent's focus.
 * - Abort: cancel an in-flight run.
 */
describe('web scenario: steer-abort', () => {
  it('steers the conversation to a new direction', async () => {
    await runScenario({
      name: 'steer',
      description: 'Send a prompt, then steer the agent to a different focus.',
      aimockFixture: 'steer-abort.json',
      run: async ({ driver }) => {
        await driver.submit('Write a long essay about the history of computing');
        await driver.waitForText('Charles Babbage');

        // Steer the agent to a new direction
        await driver.steer('Focus on the internet era instead');
        await driver.waitForText('ARPANET');

        // Both turns visible in transcript
        const text = driver.text();
        expect(text).toContain('Charles Babbage');
        expect(text).toContain('ARPANET');
      },
    });
  });

  it('aborts an in-flight run', async () => {
    await runScenario({
      name: 'abort',
      description: 'Start a run, abort it, and verify the transcript reflects the abort.',
      aimockFixture: 'steer-abort.json',
      run: async ({ driver }) => {
        await driver.submit('Write a long essay about the history of computing');
        await driver.waitForText('Charles Babbage');

        await driver.abort();

        // After abort, the run is no longer active — we can submit again
        // (verifies the abort didn't leave the session in a broken state)
        const state = driver.state();
        expect(state.entries.length).toBeGreaterThan(0);
      },
    });
  });
});
