import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

export const backgroundToolsSettingsScenario: McE2eScenario = {
  name: 'background-tools-settings',
  description: 'Toggle background tools through settings without changing the running session.',
  testName: 'persists background tools on and off with a restart notice',
  env({ appDataDir }) {
    return { MC_E2E_BACKGROUND_SETTINGS_PATH: join(appDataDir, 'config.json') };
  },
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'config.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    settings.signals = {
      unixSocketPubSub: false,
      experimentalGithubSignals: false,
      experimentalCrossAgentSignals: false,
      githubPollIntervalMs: 60_000,
    };
    writeFileSync(settingsPath, JSON.stringify(settings));
  },
  async run({ terminal, runtime }) {
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);
    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'background-tools-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_BACKGROUND_SETTINGS_PATH;
    if (!settingsPath) throw new Error('Missing background settings path');
    const readSettings = () => JSON.parse(readFileSync(settingsPath, 'utf8'));
    const before = readSettings();
    if (before.backgroundTools?.enabled === true) throw new Error('Background tools must default off');

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental background tools\s+Off/i, terminal);
    terminal.write('\x1b[B'.repeat(8));
    terminal.write('\r');
    await runtime.waitForScreenText(/Enable background tools and the activity center/i, terminal);
    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental background tools\s+On/i, terminal);
    if (readSettings().backgroundTools?.enabled !== true) throw new Error('Background tools were not saved as enabled');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental background tools: on \(restart required\)/i, terminal);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental background tools\s+On/i, terminal);
    terminal.write('\x1b[B'.repeat(8));
    terminal.write('\r');
    await runtime.waitForScreenText(/Enable background tools and the activity center/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental background tools\s+Off/i, terminal);
    const after = readSettings();
    if (after.backgroundTools?.enabled !== false) throw new Error('Background tools were not saved as disabled');
    if (JSON.stringify(after.signals) !== JSON.stringify(before.signals)) {
      throw new Error('Changing background tools modified signal settings');
    }
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental background tools: off \(restart required\)/i, terminal);
  },
};
