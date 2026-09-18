import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const modelsPackActivationPersistenceScenario = {
  name: 'models-pack-activation-persistence',
  description: 'Activates a saved custom model pack through /models and verifies persisted settings.',
  testName: 'activates a saved custom pack from /models and persists active defaults',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'config.json');
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
        name: 'Models Pack E2E',
        url: 'http://127.0.0.1:43211/v1',
        apiKey: 'sk-models-pack-e2e',
        models: ['plan-e2e', 'build-e2e', 'fast-e2e'],
      },
    ];
    settings.customModelPacks = [
      {
        name: 'Models Pack E2E',
        models: {
          plan: 'models-pack-e2e/plan-e2e',
          build: 'models-pack-e2e/build-e2e',
          fast: 'models-pack-e2e/fast-e2e',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: { explore: 'stale-provider/stale-model' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime, readGlobalSettings }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/packs');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Models Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/plan\s+→\s+models-pack-e2e\/plan-e2e/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Models Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Activate\s+Use this pack as-is/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to Models Pack E2E pack/i, terminal, 8_000);

    const settings = readGlobalSettings();
    if (
      settings.models.activeModelPackId !== 'custom:Models Pack E2E' ||
      settings.models.modeDefaults.plan !== 'models-pack-e2e/plan-e2e' ||
      settings.models.modeDefaults.build !== 'models-pack-e2e/build-e2e' ||
      settings.models.modeDefaults.fast !== 'models-pack-e2e/fast-e2e' ||
      Object.keys(settings.models.subagentModels).length !== 0 ||
      settings.customModelPacks.length !== 1
    ) {
      throw new Error('Expected the activated model pack in global settings');
    }

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
