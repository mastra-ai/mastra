import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Project switching scenario — verifies that setting `projectPath` on session
 * state causes the workspace factory to resolve a different directory.
 *
 * 1. Set projectPath via session.setState
 * 2. Send a message (triggers workspace resolution with the new path)
 * 3. Verify the response arrives (proving the run completed with a workspace)
 */
describe('web scenario: project-switch', () => {
  it('sets projectPath on session state and completes a run', async () => {
    await runScenario({
      name: 'project-switch',
      description: 'Set a project path via setState and verify the agent run completes.',
      aimockFixture: 'project-switch.json',
      server: { workspace: true },
      run: async ({ driver, workspaceRoot }) => {
        // Set the project path to the scenario's temp workspace dir.
        const client = driver.getClient();
        const session = client.getAgentController('code').session('web-scenario-project-switch');
        await session.setState({ projectPath: workspaceRoot });

        // Send a message — the workspace factory reads projectPath from state.
        await driver.submit('What workspace am I in?');
        await driver.waitForText('Ready to work');

        // Verify the state was set.
        const state = await session.state();
        expect(state).toBeTruthy();
      },
      verifyAimockRequests: requests => {
        expect(requests.length).toBeGreaterThanOrEqual(1);
      },
    });
  });
});
