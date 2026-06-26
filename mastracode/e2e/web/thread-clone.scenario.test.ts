import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Create a thread, rename it, verify the rename persists via the list endpoint.
 * Also exercise thread deletion to prove the full lifecycle route coverage.
 */
describe('web scenario: thread-lifecycle', () => {
  it('creates, renames, and deletes threads via the API', async () => {
    await runScenario({
      name: 'thread-lifecycle',
      description: 'Create, rename, list, and delete a thread.',
      aimockFixture: 'thread-clone.json',
      run: async ({ driver }) => {
        // Send a message so the initial thread has content.
        await driver.submit('original message');
        await driver.waitForText('original response');
        await driver.waitForIdle();

        const originalThreadId = driver.state().threadId!;
        expect(originalThreadId).toBeTruthy();

        // Create a second thread.
        const created = await driver.createThread('Second thread');
        expect(created.id).toBeTruthy();
        expect(created.id).not.toBe(originalThreadId);

        // Rename the second thread.
        const client = driver.getClient();
        const session = client.getAgentController('code').session('web-scenario-thread-lifecycle');
        await session.renameThread(created.id, 'Renamed thread');

        // List threads — should include both.
        const threads = await driver.listThreads();
        const names = threads.map(t => t.title);
        expect(names).toContain('Renamed thread');

        // Delete the renamed thread.
        await session.deleteThread(created.id);

        // List again — deleted thread should be gone.
        const threadsAfter = await driver.listThreads();
        const ids = threadsAfter.map(t => t.id);
        expect(ids).not.toContain(created.id);
      },
    });
  });
});
