import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Verify the behavior settings bridge: the session-state route reports the
 * functional, agent-consumed settings (yolo, thinkingLevel, notifications,
 * smartEditing) that mirror the TUI's `/settings` command, and that writing
 * them via the setState route round-trips back through the read route — the
 * exact path the web Settings modal uses.
 */
describe('web scenario: settings-behavior', () => {
  it('reports and updates behavior settings through the session-state routes', async () => {
    const resourceId = 'web-scenario-settings-behavior';
    await runScenario({
      name: 'settings-behavior',
      description: 'Behavior settings round-trip via session-state read + setState routes.',
      aimockFixture: 'automated-chat.json',
      resourceId,
      // yolo:true is the scenario default; assert it surfaces, then flip it off.
      run: async ({ driver, baseUrl, fetch: rawFetch }) => {
        // Drive one chat so the session is fully live (and to satisfy the
        // scenario's ">= 1 AIMock request" guard). Wait for the AIMock-backed
        // response so the run has actually hit the model before we assert.
        await driver.submit('Say the smoke phrase');
        await driver.waitForText('WEB scenario smoke response');

        const base = `${baseUrl}/api/harness/code/sessions/${resourceId}`;
        const readUrl = base; // GET base returns the session-state snapshot
        const writeUrl = `${base}/state`; // PUT /state merges updates

        // Initial settings are exposed on the read route.
        const before = (await (await rawFetch(readUrl)).json()) as {
          settings?: {
            yolo: boolean;
            thinkingLevel: string;
            notifications: string;
            smartEditing: boolean;
          };
        };
        expect(before.settings).toBeDefined();
        expect(before.settings!.yolo).toBe(true);
        expect(['off', 'low', 'medium', 'high', 'xhigh']).toContain(before.settings!.thinkingLevel);
        expect(['off', 'bell', 'system', 'both']).toContain(before.settings!.notifications);

        // Write new values via the setState route (what the modal calls).
        const put = await rawFetch(writeUrl, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            state: { yolo: false, thinkingLevel: 'high', notifications: 'both', smartEditing: false },
          }),
        });
        expect(put.ok).toBe(true);

        // Re-read: the new values must round-trip back.
        const after = (await (await rawFetch(readUrl)).json()) as {
          settings?: {
            yolo: boolean;
            thinkingLevel: string;
            notifications: string;
            smartEditing: boolean;
          };
        };
        expect(after.settings).toEqual({
          yolo: false,
          thinkingLevel: 'high',
          notifications: 'both',
          smartEditing: false,
        });
      },
    });
  });
});
