import { expect } from '@microsoft/tui-test';

import type { McE2eScenario } from './types.js';

const MODEL_ATTRIBUTION = 'Co-Authored-By: Mastra Code (openai/gpt-5.4-mini) <noreply@mastra.ai>';
const FALLBACK_ATTRIBUTION = 'Co-Authored-By: Mastra Code <noreply@mastra.ai>';

export const commitAttributionPromptScenario: McE2eScenario = {
  name: 'commit-attribution-prompt',
  description: 'Verify real TUI prompts include model-specific commit attribution guidance in the model request.',
  testName: 'includes selected model ID in commit attribution prompt guidance',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'commit-attribution-prompt.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    terminal.submit('Confirm the commit attribution prompt guidance.');
    await runtime.waitForScreenText(/Commit attribution prompt guidance e2e acknowledged\./i, terminal, 10_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected commit attribution scenario to make 1 AIMock request, received ${requests.length}`);
    }
    const body = JSON.stringify(requests);
    expect(body).toContain(MODEL_ATTRIBUTION);
    expect(body).not.toContain(FALLBACK_ATTRIBUTION);
  },
};
