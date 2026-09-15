import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

export const storageStartupPgFallbackScenario: McE2eScenario = {
  name: 'storage-startup-pg-fallback',
  description:
    'Verify persisted PostgreSQL storage settings are read on startup and fall back visibly when incomplete.',
  testName: 'loads persisted PostgreSQL storage settings at startup and shows fallback warning',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.storage = {
      ...settings.storage,
      backend: 'pg',
      pg: {
        connectionString: '',
        host: undefined,
        port: undefined,
        database: undefined,
        user: undefined,
        password: undefined,
        schemaName: undefined,
        disableInit: undefined,
        skipDefaultIndexes: undefined,
      },
    };
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/PostgreSQL backend selected but no connection info configured/i, terminal, 8_000);
    await runtime.waitForScreenText(/Using LibSQL fallback/i, terminal, 8_000);
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal, 8_000);
    runtime.printScreen('after startup warning', terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("STORAGE_STARTUP_BACKEND="+s.storage.backend+":"+Boolean(s.storage.pg));'`,
    );
    await runtime.waitForScreenText(/STORAGE_STARTUP_BACKEND=pg:true/i, terminal, 8_000);
  },
};
