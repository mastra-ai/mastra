import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const modelsPackActivationPersistenceScenario = {
  name: 'models-pack-activation-persistence',
  description: 'Activates a saved custom model pack through /models and verifies persisted settings.',
  testName: 'activates a saved custom pack from /models and persists active defaults',
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
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Models Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/plan\s+→\s+models-pack-e2e\/plan-e2e/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Models Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Activate\s+Use this pack as-is/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to Models Pack E2E pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("MODELS_ACTIVE="+s.models.activeModelPackId); console.log("MODELS_DEFAULT_PLAN="+s.models.modeDefaults.plan); console.log("MODELS_DEFAULT_BUILD="+s.models.modeDefaults.build); console.log("MODELS_DEFAULT_FAST="+s.models.modeDefaults.fast); console.log("MODELS_SUBAGENTS="+Object.keys(s.models.subagentModels||{}).length); console.log("MODELS_PACK_COUNT="+s.customModelPacks.length)'`,
    );
    await runtime.waitForScreenText(/MODELS_ACTIVE=custom:Models Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODELS_DEFAULT_PLAN=models-pack-e2e\/plan-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODELS_DEFAULT_BUILD=models-pack-e2e\/build-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODELS_DEFAULT_FAST=models-pack-e2e\/fast-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODELS_SUBAGENTS=0/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODELS_PACK_COUNT=1/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
