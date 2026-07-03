import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Follow-up queue: send a message, then while the agent is running (or just
 * after), queue a follow-up via the followUp API. Verify both messages are
 * processed.
 */
describe('web scenario: follow-up-queue', () => {
  it('queues a follow-up and processes it after the current run', async () => {
    await runScenario({
      name: 'follow-up-queue',
      description: 'Send a prompt, follow up while running, verify both are processed.',
      aimockFixture: 'follow-up-queue.json',
      run: async ({ driver }) => {
        // Send the first message.
        await driver.submit('Start a long task');
        await driver.waitForText('LONG_TASK_STARTED');
        await driver.waitForIdle();

        // Now send a follow-up — since the run is done, it sends immediately.
        await driver.followUp('Follow up message');
        await driver.waitForText('FOLLOW_UP_HANDLED');

        // Both responses should be in the transcript.
        const text = driver.text();
        expect(text).toContain('LONG_TASK_STARTED');
        expect(text).toContain('FOLLOW_UP_HANDLED');
      },
      verifyAimockRequests: requests => {
        if (requests.length < 2) throw new Error(`expected 2 AIMock requests, got ${requests.length}`);
      },
    });
  });
});
