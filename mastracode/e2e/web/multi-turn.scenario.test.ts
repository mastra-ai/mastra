import { describe, it } from 'vitest';

import { runScenario } from './harness';

/**
 * Web equivalent of a multi-turn MastraCode conversation: two sequential
 * prompts both stream into the same transcript, proving the session is durable
 * across turns (one resourceId → one thread → continuous history).
 */
describe('web scenario: multi-turn', () => {
  it('keeps both turns in the transcript', async () => {
    await runScenario({
      name: 'multi-turn',
      description: 'Two sequential prompts both render in the same session transcript.',
      aimockFixture: 'multi-turn.json',
      run: async ({ driver }) => {
        await driver.submit('My name is Ada');
        await driver.waitForText('Nice to meet you, Ada');

        await driver.submit('What is my name?');
        await driver.waitForText('Your name is Ada');
      },
      verifyAimockRequests: requests => {
        if (requests.length < 2) throw new Error(`expected two AIMock requests, got ${requests.length}`);
      },
    });
  });
});
