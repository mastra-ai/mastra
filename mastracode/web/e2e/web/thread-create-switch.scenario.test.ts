import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Thread lifecycle: create a new thread, send a message, create a second thread,
 * send a different message, then switch back to the first and verify isolation.
 */
describe('web scenario: thread-create-switch', () => {
  it('creates threads and switches between them', async () => {
    await runScenario({
      name: 'thread-create-switch',
      description: 'Create two threads, send messages in each, switch back and verify thread isolation.',
      aimockFixture: 'thread-create-switch.json',
      run: async ({ driver }) => {
        // Send a message on the initial (auto-created) thread.
        await driver.submit('Hello from thread one');
        await driver.waitForText('THREAD_ONE_RESPONSE');
        const firstThreadId = driver.state().threadId;
        expect(firstThreadId).toBeTruthy();

        // Create a new thread — the session switches to it.
        await driver.createThread('Second Thread');
        const secondThreadId = driver.state().threadId;
        expect(secondThreadId).toBeTruthy();
        expect(secondThreadId).not.toBe(firstThreadId);

        // Transcript should be empty on the new thread.
        expect(driver.text().includes('THREAD_ONE')).toBe(false);

        // Send a message on the second thread.
        await driver.submit('Hello from thread two');
        await driver.waitForText('THREAD_TWO_RESPONSE');

        // Both threads should appear in the list.
        const threads = await driver.listThreads();
        expect(threads.length).toBeGreaterThanOrEqual(2);

        // Switch back to the first thread.
        await driver.switchThread(firstThreadId!);
        expect(driver.state().threadId).toBe(firstThreadId);
      },
    });
  });
});
