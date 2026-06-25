import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Goal lifecycle: set a goal via the API, verify it persists, send a message
 * that works toward it, then clear the goal.
 */
describe('web scenario: goal-loop', () => {
  it('sets, reads, and clears a goal', async () => {
    await runScenario({
      name: 'goal-loop',
      description: 'Set a goal objective, verify it persists, work toward it, then clear.',
      aimockFixture: 'goal-loop.json',
      run: async ({ driver }) => {
        // Set a goal.
        await driver.setGoal('Build a complete web application');

        // Read it back.
        const goal = (await driver.getGoal()) as { objective: string; status: string } | undefined;
        expect(goal).toBeDefined();
        expect(goal!.objective).toBe('Build a complete web application');
        expect(goal!.status).toBe('active');

        // Send a message to work toward the goal.
        await driver.submit('Work toward the goal');
        await driver.waitForText('GOAL_WORK');
        await driver.waitForIdle();

        // Clear the goal.
        await driver.clearGoal();
        const cleared = await driver.getGoal();
        expect(cleared).toBeUndefined();
      },
    });
  });
});
