import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const customProviderDeleteScenario = {
  name: 'custom-provider-delete',
  description: 'deletes a configured OpenAI-compatible provider through the real TUI custom-providers modal flow',
  testName: 'deletes a custom provider through the real TUI and persists removal',
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
        name: 'Delete Me E2E',
        url: 'http://127.0.0.1:43212/v1',
        apiKey: 'sk-e2e-delete-provider',
        models: ['delete-model-e2e'],
      },
    ];
    settings.customModelPacks = [
      {
        name: 'Delete Me Pack',
        models: {
          plan: 'delete-me-e2e/delete-model-e2e',
          build: 'delete-me-e2e/delete-model-e2e',
          fast: 'delete-me-e2e/delete-model-e2e',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Delete Me E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/1 model/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Delete Me E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Delete provider/i, terminal, 8_000);

    terminal.write('\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Delete Delete Me E2E\?/i, terminal, 8_000);
    await runtime.waitForScreenText(/This cannot be undone/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Deleted custom provider: Delete Me E2E/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("CUSTOM_PROVIDER_COUNT="+s.customProviders.length); console.log("CUSTOM_PROVIDER_NAMES="+s.customProviders.map(p=>p.name).join("|")); console.log("CUSTOM_PACK_COUNT="+s.customModelPacks.length)'`,
    );
    await runtime.waitForScreenText(/CUSTOM_PROVIDER_COUNT=0/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_PROVIDER_NAMES=/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_PACK_COUNT=1/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
