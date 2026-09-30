import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';
import { selectMenuRow } from './menu-navigation.js';
import type { McE2eScenario } from './types.js';

export const crossAgentSettingsScenario: McE2eScenario = {
  name: 'cross-agent-settings',
  description:
    'Enable experimental cross-agent communication and cross-project agent discovery through the real TUI settings overlay.',
  testName: 'persists the experimental cross-agent communication and cross-project discovery settings',
  env({ appDataDir }) {
    return {
      MC_E2E_CROSS_AGENT_SETTINGS_PATH: join(appDataDir, 'settings.json'),
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental cross-agent communication/i, terminal);

    await selectMenuRow(terminal, /Experimental cross-agent communication/i);
    await runtime.waitForScreenText(/Enable cross-agent connection tools/i, terminal);

    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental cross-agent communication\s+On/i, terminal);

    await selectMenuRow(terminal, /Experimental cross-project agent discovery/i);
    await runtime.waitForScreenText(/Agents in other projects can find and message this one/i, terminal);

    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental cross-project agent discovery\s+On/i, terminal);

    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'cross-agent-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_CROSS_AGENT_SETTINGS_PATH;
    if (!settingsPath || !existsSync(settingsPath)) {
      throw new Error(`Expected settings file to exist at ${settingsPath ?? '<unset>'}`);
    }
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      signals?: { experimentalCrossAgentSignals?: boolean; experimentalCrossProjectAgentSignals?: boolean };
    };
    if (settings.signals?.experimentalCrossAgentSignals !== true) {
      throw new Error('Expected experimental cross-agent communication to persist as enabled');
    }
    if (settings.signals?.experimentalCrossProjectAgentSignals !== true) {
      throw new Error('Expected experimental cross-project agent discovery to persist as enabled');
    }
  },
};
