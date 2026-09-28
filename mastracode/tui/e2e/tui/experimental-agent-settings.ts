import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

export const experimentalAgentSettingsScenario: McE2eScenario = {
  name: 'experimental-agent-settings',
  description: 'Select the experimental coding agent runtime through the real TUI settings overlay.',
  testName: 'persists durable, evented, and off experimental agent selections',
  env({ appDataDir }) {
    return { MC_E2E_EXPERIMENTAL_AGENT_SETTINGS_PATH: join(appDataDir, 'settings.json') };
  },
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    settings.experimentalAgent = null;
    settings.backgroundTools = { enabled: false };
    writeFileSync(settingsPath, JSON.stringify(settings));
  },
  async run({ terminal, runtime }) {
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);
    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'experimental-agent-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_EXPERIMENTAL_AGENT_SETTINGS_PATH;
    if (!settingsPath) throw new Error('Missing experimental agent settings path');
    const readSettings = () => JSON.parse(readFileSync(settingsPath, 'utf8'));

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental agent\s+Off/i, terminal);
    terminal.write('\x1b[B'.repeat(8));
    terminal.write('\r');
    await runtime.waitForScreenText(/Use the standard coding agent/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental agent\s+Durable/i, terminal);
    if (readSettings().experimentalAgent !== 'durable') throw new Error('Durable agent selection was not saved');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental agent: durable \(restart required\)/i, terminal);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental agent\s+Durable/i, terminal);
    terminal.write('\x1b[B'.repeat(8));
    terminal.write('\r');
    await runtime.waitForScreenText(/Use resumable durable agent streams/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental agent\s+Evented/i, terminal);
    if (readSettings().experimentalAgent !== 'evented') throw new Error('Evented agent selection was not saved');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental agent: evented \(restart required\)/i, terminal);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Experimental agent\s+Evented/i, terminal);
    terminal.write('\x1b[B'.repeat(8));
    terminal.write('\r');
    await runtime.waitForScreenText(/Run the agent loop on the evented workflow engine/i, terminal);
    terminal.write('\x1b[A'.repeat(2));
    terminal.write('\r');
    await runtime.waitForScreenText(/Experimental agent\s+Off/i, terminal);
    const after = readSettings();
    if (after.experimentalAgent !== null) throw new Error('Off agent selection was not saved as null');
    if (after.backgroundTools?.enabled !== false) throw new Error('Changing the agent modified background tools');
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Experimental agent: off \(restart required\)/i, terminal);
  },
};
