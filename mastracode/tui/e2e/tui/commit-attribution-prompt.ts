import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const PLATFORM_BOT_ATTRIBUTION =
  'Co-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>';

export const commitAttributionPromptScenario: McE2eScenario = {
  name: 'commit-attribution-prompt',
  description:
    'Verify real TUI prompts include platform bot commit attribution guidance and the authored commit records it.',
  testName: 'includes platform bot commit attribution prompt guidance and committed history',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'commit-attribution-prompt.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    terminal.submit('Create a deterministic commit to verify attribution guidance.');
    await runtime.waitForScreenText(/Commit attribution git history e2e complete\./i, terminal, 20_000);

    terminal.submit('!git log -1 --format=%B');
    await runtime.waitForScreenText(/test: commit attribution e2e/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /Co-Authored-By: mastra-platform\[bot\] <284800079\+mastra-platform\[bot\]@users\.noreply\.github\.com>/i,
      terminal,
      10_000,
    );

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected commit attribution scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const body = JSON.stringify(requests);
    expect(body).toContain(PLATFORM_BOT_ATTRIBUTION);
    expect(body).toContain('git commit');
  },
};
