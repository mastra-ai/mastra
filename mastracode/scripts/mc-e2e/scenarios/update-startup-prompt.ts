import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const updateStartupPromptScenario: McE2eScenario = {
  name: 'update-startup-prompt',
  description: 'Shows the automatic startup update prompt with hermetic version/changelog data and persists dismissal.',
  testName: 'shows startup update changelog prompt and persists No through the real TUI',
  env() {
    return {
      MASTRACODE_UPDATE_LATEST_VERSION: '99.1.0',
      MASTRACODE_UPDATE_CHANGELOG: '  • Startup update prompt e2e fixture entry',
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/A new version of Mastra Code is available: v99\.1\.0/i, terminal, 10_000);
    await runtime.waitForScreenText(/What's new/i, terminal);
    await runtime.waitForScreenText(/Startup update prompt e2e fixture entry/i, terminal);
    await runtime.waitForScreenText(/Would you like to update now/i, terminal);
    await runtime.waitForScreenText(/Yes/i, terminal);
    await runtime.waitForScreenText(/No/i, terminal);

    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');

    await runtime.waitForScreenText(/Update skipped\. Run \/update to update later\./i, terminal, 8_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("STARTUP_UPDATE_DISMISSED="+s.updateDismissedVersion);'`,
    );
    await runtime.waitForScreenText(/STARTUP_UPDATE_DISMISSED=99\.1\.0/i, terminal, 8_000);
    await (expect(terminal.getByText(/›|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
