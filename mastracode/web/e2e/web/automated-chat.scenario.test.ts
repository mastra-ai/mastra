import { describe, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's `automated-chat` scenario: submit one prompt
 * and assert the AIMock-backed model response renders in the transcript.
 */
describe('web scenario: automated-chat', () => {
  it('streams a chat response into the transcript', async () => {
    await runScenario({
      name: 'automated-chat',
      description:
        'Submit a prompt to the real controller and assert the AIMock response appears in the UI transcript.',
      aimockFixture: 'automated-chat.json',
      run: async ({ driver }) => {
        await driver.submit('Say the smoke phrase');
        await driver.waitForText('WEB scenario smoke response');
      },
      verifyAimockRequests: requests => {
        if (requests.length < 1) throw new Error(`expected an AIMock request, got ${requests.length}`);
      },
    });
  });
});
