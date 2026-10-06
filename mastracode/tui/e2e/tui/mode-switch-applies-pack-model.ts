import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const packName = 'Mode Switch E2E';
const packId = `custom:${packName}`;

export const modeSwitchAppliesPackModelScenario = {
  name: 'mode-switch-applies-pack-model',
  description: 'Switching modes applies the active pack model for the new mode.',
  testName: 'applies the active pack model when Shift+Tab switches modes',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      modePackId: packId,
      quietModePreferenceSelected: true,
    };
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          build: 'mode-switch-e2e/build-model',
          plan: 'mode-switch-e2e/plan-model',
          fast: 'mode-switch-e2e/fast-model',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: packId,
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/▐build▌mode-switch-e2e\/build-model/i, terminal, 8_000);

    terminal.write('\x1b[Z');
    await runtime.waitForScreenText(/▐plan▌mode-switch-e2e\/plan-model/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
