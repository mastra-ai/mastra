import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const providerName = 'Pack Import Rename E2E';
const originalPackName = 'Import Rename E2E';
const renamedPackName = 'Imported Renamed E2E';
const providerId = 'pack-import-rename-e2e';
const importedPack = {
  name: originalPackName,
  models: {
    plan: `${providerId}/import-plan`,
    build: `${providerId}/import-build`,
    fast: `${providerId}/import-fast`,
  },
};
const importedPackString = `mastra-pack:${Buffer.from(JSON.stringify(importedPack), 'utf8').toString('base64')}`;

export const customPackImportRenameScenario = {
  name: 'custom-pack-import-rename',
  description: 'Imports a shared custom model pack through /models, renames a name collision, and verifies persistence.',
  testName: 'imports a shared custom pack by renaming a name collision and persists both packs',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.customProviders = [
      {
        name: providerName,
        url: 'http://127.0.0.1:43213/v1',
        apiKey: 'sk-pack-import-rename-e2e',
        models: ['old-plan', 'old-build', 'old-fast', 'import-plan', 'import-build', 'import-fast'],
      },
    ];
    settings.customModelPacks = [
      {
        name: originalPackName,
        models: {
          plan: `${providerId}/old-plan`,
          build: `${providerId}/old-build`,
          fast: `${providerId}/old-fast`,
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Import Rename E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Import Pack/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Paste the shared model pack string/i, terminal, 8_000);
    terminal.write(importedPackString);
    terminal.write('\r');

    await runtime.waitForScreenText(/A pack named "Import Rename E2E" already exists/i, terminal, 8_000);
    await runtime.waitForScreenText(/Rename\s+Choose a different name for the imported pack/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Name this custom pack/i, terminal, 8_000);
    terminal.write('\x0b');
    terminal.write(renamedPackName);
    terminal.write('\r');

    await runtime.waitForScreenText(/Imported and activated Imported Renamed E2E pack/i, terminal, 8_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const packs=s.customModelPacks; const original=packs.find(p=>p.name==="Import Rename E2E"); const renamed=packs.find(p=>p.name==="Imported Renamed E2E"); const same=(a,b,c,d,e,f)=>a===d&&b===e&&c===f; console.log("IMPORT_RENAME_COUNT="+packs.length); console.log("IMPORT_RENAME_NAMES="+packs.map(p=>p.name).sort().join("|")); console.log("IMPORT_RENAME_ACTIVE="+s.models.activeModelPackId); console.log("IMPORT_RENAME_DEFAULTS_OK="+same(s.models.modeDefaults.plan,s.models.modeDefaults.build,s.models.modeDefaults.fast,"pack-import-rename-e2e/import-plan","pack-import-rename-e2e/import-build","pack-import-rename-e2e/import-fast")); console.log("IMPORT_RENAME_ORIGINAL_OK="+same(original?.models?.plan,original?.models?.build,original?.models?.fast,"pack-import-rename-e2e/old-plan","pack-import-rename-e2e/old-build","pack-import-rename-e2e/old-fast")); console.log("IMPORT_RENAME_IMPORTED_OK="+same(renamed?.models?.plan,renamed?.models?.build,renamed?.models?.fast,"pack-import-rename-e2e/import-plan","pack-import-rename-e2e/import-build","pack-import-rename-e2e/import-fast"));'`,
    );
    await runtime.waitForScreenText(/IMPORT_RENAME_COUNT=2/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_RENAME_NAMES=Import Rename E2E\|Imported Renamed E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_RENAME_ACTIVE=custom:Imported Renamed E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_RENAME_DEFAULTS_OK=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_RENAME_ORIGINAL_OK=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_RENAME_IMPORTED_OK=true/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
