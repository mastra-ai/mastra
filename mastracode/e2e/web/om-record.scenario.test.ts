import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Verify the OM record API is accessible. Without OM configured, it should
 * return null/undefined (no crash). This exercises the route + SDK path
 * end-to-end.
 */
describe('web scenario: om-record', () => {
  it('reads OM record without crash (returns gracefully when not configured)', async () => {
    await runScenario({
      name: 'om-record',
      description: 'OM record route returns gracefully when OM is not configured.',
      aimockFixture: 'om-record.json',
      run: async ({ driver, baseUrl, fetch: rawFetch }) => {
        // Send a message so the session has an active thread.
        await driver.submit('hello');
        await driver.waitForText('checked OM record');
        await driver.waitForIdle();

        const threadId = driver.state().threadId!;
        expect(threadId).toBeTruthy();

        // Read the OM record via the API.
        const res = await rawFetch(
          `${baseUrl}/api/harness/code/sessions/web-scenario-om-record/om?threadId=${threadId}`,
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        // OM is not configured on the scenario harness, so record should be absent/null.
        expect(body.record == null || body.record === undefined).toBe(true);
      },
    });
  });
});
