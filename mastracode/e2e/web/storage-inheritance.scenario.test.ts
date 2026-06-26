import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Storage inheritance: the Harness is built with NO storage of its own, and
 * storage is configured on the parent Mastra instead. This is the production
 * web-server wiring (`new Mastra({ harnesses, storage })`). Thread persistence
 * must still work, proving the Harness reads through the parent Mastra's store
 * (Harness#resolveStorage).
 */
describe('web scenario: storage-inheritance', () => {
  it('persists threads through the parent Mastra storage when the harness has none', async () => {
    await runScenario({
      name: 'storage-inheritance',
      description: 'Harness with no storage inherits the parent Mastra store; created threads still persist.',
      aimockFixture: 'automated-chat.json',
      server: { inheritStorageFromMastra: true },
      run: async ({ driver }) => {
        // Drive a turn on the auto-created thread, then create a second one.
        await driver.submit('Say the smoke phrase');
        await driver.waitForText('WEB scenario smoke response');
        const firstThreadId = driver.state().threadId;
        expect(firstThreadId).toBeTruthy();

        await driver.createThread('Persisted Thread');
        const secondThreadId = driver.state().threadId;
        expect(secondThreadId).toBeTruthy();
        expect(secondThreadId).not.toBe(firstThreadId);

        // Listing reads back through the inherited Mastra storage. If the
        // harness were silently storage-less, this would be empty.
        const threads = await driver.listThreads();
        const ids = threads.map(t => t.id);
        expect(ids).toContain(secondThreadId);
        expect(threads.length).toBeGreaterThanOrEqual(2);
      },
    });
  });
});
