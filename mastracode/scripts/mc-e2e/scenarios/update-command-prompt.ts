import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const updateCommandPromptScenario: McE2eScenario = {
  name: 'update-command-prompt',
  description:
    'Runs /update through the real TUI with a hermetic latest-version/changelog response and dismisses the prompt.',
  testName: 'shows update changelog prompt and persists No through the real TUI',
  env() {
    return {
      MASTRACODE_DISABLE_UPDATE_CHECK: '1',
      MASTRACODE_UPDATE_LATEST_VERSION: '99.0.0',
      MASTRACODE_UPDATE_CHANGELOG: '  • Update prompt e2e fixture entry',
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    terminal.submit('/update');

    await runtime.waitForScreenText(/A new version is available: v99\.0\.0/i, terminal, 10_000);
    await runtime.waitForScreenText(/What's new/i, terminal);
    await runtime.waitForScreenText(/Update prompt e2e fixture entry/i, terminal);
    await runtime.waitForScreenText(/Would you like to update now/i, terminal);
    await runtime.waitForScreenText(/Yes/i, terminal);
    await runtime.waitForScreenText(/No/i, terminal);

    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');

    await runtime.waitForScreenText(/Update skipped/i, terminal);
    await (expect(terminal.getByText(/›|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
