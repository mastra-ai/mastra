import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's notification flow: a notification signal is
 * sent to the session, the agent's delivery policy determines how to handle it,
 * and the notification event appears in the SSE stream / transcript.
 *
 * This exercises the full notification pipeline:
 *   POST /agent-controller/:controllerId/sessions/:rId/notifications
 *     → session.sendNotificationSignal(input)
 *       → agent delivery policy decision
 *         → notification event on SSE stream
 *           → transcript reducer updates UI state
 */
describe('web scenario: notification', () => {
  it('delivers a high-priority notification to the session', async () => {
    await runScenario({
      name: 'notification-delivery',
      description: 'Send a notification signal to the session; verify it appears in the transcript.',
      aimockFixture: 'notification.json',
      run: async ({ driver }) => {
        // Send a high-priority notification — delivery policy should deliver
        // immediately (high and urgent notifications wake idle threads).
        await driver.sendNotification({
          source: 'github',
          kind: 'pr_review',
          summary: 'PR #42 was approved by reviewer',
          priority: 'high',
          payload: { pr: 42, repo: 'mastra-ai/mastra' },
        });

        // The notification triggers an agent run (wakes the idle thread).
        // Wait for the agent to process and respond.
        await driver.waitForText('received the notification', 20_000);

        // Verify transcript has both the notification-driven response and
        // the transcript state reflects the notification was processed.
        const state = driver.state();
        const assistantEntries = state.entries.filter(e => e.kind === 'message' && e.message.role === 'assistant');
        expect(assistantEntries.length).toBeGreaterThan(0);
      },
    });
  });

  it('delivers a medium-priority notification that wakes the idle thread', async () => {
    await runScenario({
      name: 'notification-medium',
      description: 'A medium-priority notification should also wake an idle thread.',
      aimockFixture: 'notification.json',
      run: async ({ driver }) => {
        await driver.sendNotification({
          source: 'ci',
          kind: 'build_status',
          summary: 'Build passed on main',
          priority: 'medium',
        });

        // Medium-priority notifications on idle threads should still deliver
        // (the default policy delivers medium when idle).
        await driver.waitForText('received the notification', 20_000);

        const state = driver.state();
        expect(state.entries.some(e => e.kind === 'message' && e.message.role === 'assistant')).toBe(true);
      },
    });
  });
});
