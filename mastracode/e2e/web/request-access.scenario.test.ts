import { describe, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's `request_access` prompt flow: the agent calls
 * the `request_access` tool, the UI surfaces a suspension prompt with the path
 * and reason, the user approves, and the run resumes with the grant message.
 */
describe('web scenario: request-access', () => {
  it('surfaces a request_access prompt and resumes when approved', async () => {
    await runScenario({
      name: 'request-access',
      description: 'Agent requests directory access; the UI renders the prompt; approving resumes the run.',
      aimockFixture: 'request-access.json',
      run: async ({ driver }) => {
        await driver.submit('Read the file at /etc/hosts');

        const prompt = await driver.waitForSuspension();
        if (prompt.toolName !== 'request_access') {
          throw new Error(`expected request_access, got ${prompt.toolName}`);
        }

        // Approve the access request
        await driver.respond('yes');
        await driver.waitForText('Access was granted');
      },
    });
  });
});
