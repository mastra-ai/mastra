import stripAnsi from 'strip-ansi';
import { showInfo } from '../../src/tui/display.js';
import type { TUIState } from '../../src/tui/state.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiState: TUIState | undefined;

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
  async inProcessApp({ startMastraCodeApp }) {
    tuiState = undefined;
    return startMastraCodeApp({
      onTuiCreated(tui) {
        tuiState = (tui as { state: TUIState }).state;
      },
    });
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

    if (!tuiState) {
      throw new Error('Expected the in-process TUI state to be available');
    }

    showInfo(tuiState, 'MCP: delayed background status');
    await runtime.waitForScreenText(/MCP: delayed background status/i, terminal);

    const view = stripAnsi(terminal.serialize().view);
    const statusIndex = view.indexOf('MCP: delayed background status');
    const promptIndex = view.indexOf('Would you like to update now');
    if (statusIndex < 0 || promptIndex < 0 || statusIndex > promptIndex) {
      throw new Error(
        `Expected the active update prompt to remain below the asynchronous MCP status message:\n${view}`,
      );
    }

    await runtime.waitForScreenText(/Would you like to update now/i, terminal);
    await runtime.waitForScreenText(/Yes/i, terminal);
    await runtime.waitForScreenText(/No/i, terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Update skipped\. Run \/update to update later\./i, terminal, 8_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("STARTUP_UPDATE_DISMISSED="+s.updateDismissedVersion);'`,
    );
    await runtime.waitForScreenText(/STARTUP_UPDATE_DISMISSED=99\.1\.0/i, terminal, 8_000);
    await (expect(terminal.getByText(/›|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.keyCtrlC();
  },
};
