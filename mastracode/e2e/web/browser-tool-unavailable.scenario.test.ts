import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Reproduces the browser-tool availability path in MastraCode web scenarios:
 * when the harness is configured with browser support, model-selected browser
 * tools should be executable instead of surfacing as unavailable tools.
 */
describe('web scenario: browser-tool-unavailable', () => {
  it('executes stagehand browser tools when the scenario server enables a browser', async () => {
    await runScenario({
      name: 'browser-tool-unavailable',
      description: 'Agent navigates with stagehand_navigate when browser tools are configured.',
      aimockFixture: 'browser-tool-unavailable.json',
      server: { browser: 'stagehand', workspace: true },
      run: async ({ driver }) => {
        await driver.submit('Open https://openclaw.ai in the browser');

        await driver.waitForText('stagehand_navigate');
        await driver.waitForText('Opened https://openclaw.ai in the browser.');

        const text = driver.text();
        expect(text).not.toContain('NoSuchToolError');
        expect(text).not.toContain('ToolNotFoundError');
        expect(text).not.toContain('available tools');
      },
      verifyAimockRequests: requests => {
        expect(JSON.stringify(requests[0])).toContain('stagehand_navigate');
      },
    });
  });
});
