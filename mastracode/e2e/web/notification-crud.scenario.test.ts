import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Send notification signals via the API and verify the round-trip works.
 * We verify the API accepts the requests and returns a valid result, even
 * if the delivery policy decides to persist (not wake) for low-priority.
 */
describe('web scenario: notification-crud', () => {
  it('sends notification signals via the API', async () => {
    await runScenario({
      name: 'notification-crud',
      description: 'Send notification signals, verify API round-trip.',
      aimockFixture: 'notification-crud.json',
      run: async ({ driver }) => {
        // Make sure the session is active (has a thread).
        await driver.submit('hello');
        await driver.waitForText('notification acknowledged');
        await driver.waitForIdle();

        // Send a notification via the SDK.
        const client = driver.getClient();
        const session = client.getHarness('code').session('web-scenario-notification-crud');
        const result = await session.sendNotification({
          source: 'ci',
          kind: 'build',
          summary: 'Build #42 passed',
          priority: 'low',
        });

        // The API should return a result (accepted, with decision info).
        expect(result).toBeDefined();

        // Send a second notification.
        const result2 = await session.sendNotification({
          source: 'github',
          kind: 'pr',
          summary: 'PR #100 needs review',
          priority: 'high',
        });
        expect(result2).toBeDefined();
      },
    });
  });
});
