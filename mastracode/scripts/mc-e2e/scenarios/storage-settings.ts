import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

const connection = 'postgresql://user:pass@localhost:5432/e2e';

export const storageSettingsScenario: McE2eScenario = {
  name: 'storage-settings',
  description: 'Exercise storage backend settings overlay through the real TUI.',
  testName: 'sets PostgreSQL storage backend with masked connection input in the real TUI',
  env({ appDataDir }) {
    return {
      MC_E2E_STORAGE_SETTINGS_PATH: join(appDataDir, 'settings.json'),
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Settings/i, terminal);
    await runtime.waitForScreenText(/Storage backend/i, terminal);
    runtime.printScreen('after /settings', terminal);

    terminal.write('\x1b[B'.repeat(6));
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/LibSQL/i, terminal);
    await runtime.waitForScreenText(/PostgreSQL/i, terminal);
    runtime.printScreen('after storage submenu', terminal);

    terminal.write('\x1b[B');
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/PostgreSQL Connection/i, terminal);
    await runtime.waitForScreenText(/Enter a connection string/i, terminal);
    runtime.printScreen('after pg select', terminal);

    terminal.write(connection);
    await runtime.sleep(500);
    const maskedScreen = terminal.serialize().view;
    expect(maskedScreen).not.toContain(connection);
    expect(maskedScreen).toMatch(/\*{20,}/);
    runtime.printScreen('after masked connection', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Storage backend changed to PostgreSQL/i, terminal);
    runtime.printScreen('after storage save', terminal);

    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'storage-settings',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_STORAGE_SETTINGS_PATH;
    if (!settingsPath || !existsSync(settingsPath)) {
      throw new Error(`Expected settings file to exist at ${settingsPath ?? '<unset>'}`);
    }
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    if (settings.storage?.backend !== 'pg') {
      throw new Error(`Expected pg storage backend, got ${settings.storage?.backend ?? '<unset>'}`);
    }
    if (settings.storage?.pg?.connectionString !== connection) {
      throw new Error(`Expected raw PostgreSQL connection string to persist, got ${settings.storage?.pg?.connectionString}`);
    }
  },
};
