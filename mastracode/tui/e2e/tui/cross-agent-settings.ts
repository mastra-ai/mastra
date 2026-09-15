import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const crossAgentSettingsScenario: McE2eScenario = {
  name: 'cross-agent-settings',
  description: 'Enable experimental cross-agent communication through the real TUI settings overlay.',
  testName: 'persists the experimental cross-agent communication setting',
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

    terminal.write('\x1b[B'.repeat(7));
    terminal.write('\r');
    await runtime.waitForScreenText(/Enable cross-agent connection tools/i, terminal);

    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental cross-agent communication\s+On/i, terminal);

    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'cross-agent-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_CROSS_AGENT_SETTINGS_PATH;
    if (!settingsPath || !existsSync(settingsPath)) {
      throw new Error(`Expected settings file to exist at ${settingsPath ?? '<unset>'}`);
    }
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      signals?: { experimentalCrossAgentSignals?: boolean };
    };
    if (settings.signals?.experimentalCrossAgentSignals !== true) {
      throw new Error('Expected experimental cross-agent communication to persist as enabled');
    }
  },
};
