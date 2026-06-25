import { describe, it } from 'vitest';

import { runScenario } from './harness';

/**
 * Web equivalent of MastraCode's `ask-user` prompt flow: the agent calls the
 * built-in `ask_user` tool, the UI surfaces a suspension prompt, the user
 * answers via `respondToToolSuspension`, and the run resumes to completion.
 */
describe('web scenario: ask-user', () => {
  it('surfaces an ask_user prompt and resumes with the chosen option', async () => {
    await runScenario({
      name: 'ask-user',
      description: 'Agent asks a question; the UI renders the prompt; answering resumes the run.',
      aimockFixture: 'ask-user.json',
      run: async ({ driver }) => {
        await driver.submit('Ask me which environment to deploy to');

        const prompt = await driver.waitForSuspension();
        if (prompt.toolName !== 'ask_user') throw new Error(`expected ask_user, got ${prompt.toolName}`);

        await driver.respond('Staging');
        await driver.waitForText('deploying to Staging');
      },
    });
  });
});
