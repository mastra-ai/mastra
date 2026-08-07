import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const providerName = 'Pack Import E2E';
const originalPackName = 'Imported Pack E2E';
const importedPack = {
  name: originalPackName,
  models: {
    plan: 'openai/gpt-5.5',
    build: 'openai/gpt-5.5',
    fast: 'openai/gpt-5.4-mini',
  },
};
const importedPackString = `mastra-pack:${Buffer.from(JSON.stringify(importedPack), 'utf8').toString('base64')}`;

export const customPackImportOverwriteScenario = {
  name: 'custom-pack-import-overwrite',
  description:
    'Imports a shared custom model pack through /models, overwrites a name collision, and verifies persistence.',
  testName: 'imports a shared custom pack over a name collision and persists the imported defaults',
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
        url: 'http://127.0.0.1:43212/v1',
        apiKey: 'sk-pack-import-e2e',
        models: ['old-plan', 'old-build', 'old-explore', 'import-plan', 'import-build', 'import-explore'],
      },
    ];
    settings.customModelPacks = [
      {
        name: originalPackName,
        models: {
          plan: 'pack-import-e2e/old-plan',
          build: 'pack-import-e2e/old-build',
          fast: 'pack-import-e2e/old-explore',
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
    await runtime.waitForScreenText(/Imported Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Import Pack/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Paste the shared model pack string/i, terminal, 8_000);
    terminal.write(importedPackString);
    terminal.write('\r');

    await runtime.waitForScreenText(/A pack named "Imported Pack E2E" already exists/i, terminal, 8_000);
    await runtime.waitForScreenText(/Overwrite\s+Replace the existing "Imported Pack E2E" pack/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Imported and activated Imported Pack E2E pack/i, terminal, 8_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const pack=s.customModelPacks.find(p=>p.name==="Imported Pack E2E"); console.log("IMPORT_PACK_COUNT="+s.customModelPacks.length); console.log("IMPORT_ACTIVE="+s.models.activeModelPackId); console.log("IMPORT_DEFAULT_PLAN="+s.models.modeDefaults.plan); console.log("IMPORT_DEFAULT_BUILD="+s.models.modeDefaults.build); console.log("IMPORT_DEFAULT_FAST="+s.models.modeDefaults.fast); console.log("IMPORT_PACK_PLAN="+pack?.models?.plan); console.log("IMPORT_PACK_BUILD="+pack?.models?.build); console.log("IMPORT_PACK_FAST="+pack?.models?.fast);'`,
    );
    await runtime.waitForScreenText(/IMPORT_PACK_COUNT=1/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_ACTIVE=custom:Imported Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_DEFAULT_PLAN=openai\/gpt-5\.5/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_DEFAULT_BUILD=openai\/gpt-5\.5/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_DEFAULT_FAST=openai\/gpt-5\.4-mini/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_PACK_PLAN=openai\/gpt-5\.5/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_PACK_BUILD=openai\/gpt-5\.5/i, terminal, 8_000);
    await runtime.waitForScreenText(/IMPORT_PACK_FAST=openai\/gpt-5\.4-mini/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
