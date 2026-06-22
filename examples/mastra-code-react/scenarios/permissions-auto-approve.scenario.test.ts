import { describe, it } from 'vitest';

import type { WebScenario } from './harness';
import { runScenario } from './harness';

const scenario: WebScenario = {
  name: 'permissions-auto-approve',
  description: 'Sets category permissions to allow, sends a tool call, and confirms no approval prompt fires.',
  aimockFixture: 'permissions-auto-approve.json',
  // Start with yolo OFF — then set permissions via the SDK, proving the route works.
  server: { yolo: false, workspace: true },
  run: async ({ driver }) => {
    // Set the specific tool to allow via the permissions API (per-tool overrides).
    const client = driver.getClient();
    const session = client.getHarness('code').session(
      `web-scenario-${scenario.name}`,
    );
    await session.setPermissionForTool('mastra_workspace_write_file', 'allow');

    // Verify permissions are set.
    const rules = await session.getPermissions();
    if (rules.tools?.mastra_workspace_write_file !== 'allow') {
      throw new Error(`Expected tool=allow, got ${rules.tools?.mastra_workspace_write_file}`);
    }

    // Send a message that triggers a tool call — should auto-approve.
    await driver.submit('Write hello.txt');
    await driver.waitForText('Done writing hello.txt with auto-approved permissions');

    // Confirm NO approval prompt appeared (the tool ran without asking).
    const approvals = driver.state().entries.filter(e => e.kind === 'approval');
    if (approvals.length > 0) {
      throw new Error('Expected no approval prompts, but found one');
    }
  },
};

describe(`web scenario: ${scenario.name}`, () => {
  it(scenario.description, () => runScenario(scenario));
});
