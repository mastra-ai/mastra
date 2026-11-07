import { describe, it } from 'vitest';

import { createDriver } from './driver';
import { runScenario } from './scenario-runner';

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

  it('answers a persisted ask_user prompt after a controller restart', async () => {
    await runScenario({
      name: 'ask-user-cold',
      description: 'Answering a persisted question after a restart resumes the original run.',
      aimockFixture: 'ask-user.json',
      server: { memory: true },
      run: async ({ driver, restartServer, baseUrl, fetch }) => {
        await driver.submit('Ask me which environment to deploy to');
        const prompt = await driver.waitForSuspension();
        if (prompt.toolName !== 'ask_user') throw new Error(`expected ask_user, got ${prompt.toolName}`);
        const threadId = driver.state().threadId;
        if (!threadId) throw new Error('expected a persisted thread');
        await new Promise(resolve => setTimeout(resolve, 500));
        await driver.dispose();
        await restartServer();
        const resumed = await createDriver({ baseUrl, fetch, resourceId: 'web-scenario-ask-user-cold' });
        try {
          await resumed.switchThread(threadId);
          const restoredPrompt = await resumed.waitForSuspension();
          const result = await resumed
            .getClient()
            .getAgentController('code')
            .session('web-scenario-ask-user-cold')
            .respondToToolSuspension(restoredPrompt.toolCallId, 'Staging');
          if (!result.ok) throw new Error(`cold answer rejected: ${JSON.stringify(result)}`);
          await resumed.waitForText('deploying to Staging');
        } finally {
          await resumed.dispose();
        }
      },
    });
  });
});
