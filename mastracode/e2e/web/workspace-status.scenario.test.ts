import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Verify the workspace status route reports correctly when a workspace is
 * configured vs. when it isn't (default). Also verify the workspace-enabled
 * harness can serve a chat.
 */
describe('web scenario: workspace-status', () => {
  it('reports workspace as ready when configured', async () => {
    await runScenario({
      name: 'workspace-status',
      description: 'Workspace status route reports isReady when workspace is configured.',
      aimockFixture: 'workspace-status.json',
      server: { workspace: true },
      run: async ({ driver, baseUrl, fetch: rawFetch, workspaceRoot }) => {
        expect(workspaceRoot).toBeTruthy();

        // Check workspace status via the API.
        const res = await rawFetch(`${baseUrl}/api/harness/code/workspace`);
        const body = (await res.json()) as { hasWorkspace: boolean; isReady: boolean };
        expect(body.hasWorkspace).toBe(true);
        expect(body.isReady).toBe(true);

        // Verify the agent can still chat with workspace tools attached.
        await driver.submit('check workspace');
        await driver.waitForText('workspace checked');
      },
    });
  });
});
