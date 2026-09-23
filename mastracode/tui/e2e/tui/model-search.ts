import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const modelSearchScenario = {
  name: 'model-search',
  description: 'Searches connected models and keeps the current mode unchanged when API-key entry is cancelled.',
  testName: 'changes the current mode model with /model and aborts a cancelled key prompt',
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
        name: 'Model Search E2E',
        url: 'http://127.0.0.1:43212/v1',
        apiKey: 'sk-model-search-e2e',
        models: ['old-model', 'new-model'],
      },
    ];
    settings.customModelPacks = [
      {
        name: 'Model Search E2E',
        models: {
          plan: 'model-search-e2e/old-model',
          build: 'model-search-e2e/old-model',
          fast: 'model-search-e2e/old-model',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: 'custom:Model Search E2E',
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/▐build▌model-search-e2e\/old-model/i, terminal, 8_000);

    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
    terminal.write('new-model');
    await runtime.waitForScreenText(/model-search-e2e\/new-model/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched build mode to model-search-e2e\/new-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/▐build▌model-search-e2e\/new-model/i, terminal, 8_000);

    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    terminal.write('cancel-only/cancelled-model');
    await runtime.waitForScreenText(/Use: cancel-only\/cancelled-model/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/API Key Required/i, terminal, 8_000);
    await runtime.waitForScreenText(/▐build▌model-search-e2e\/new-model/i, terminal, 8_000);

    terminal.submit(
      '!node -e \'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customModelPacks.find(p=>p.name==="Model Search E2E"); console.log("MODEL_CANCELLED_BUILD="+p.models.build);\'',
    );
    await runtime.waitForScreenText(/MODEL_CANCELLED_BUILD=model-search-e2e\/new-model/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
