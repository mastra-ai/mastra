import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const packName = 'Startup Restore E2E';
const packId = `custom:${packName}`;

export const settingsStartupModelRestoreScenario = {
  name: 'settings-startup-model-restore',
  description: 'restores a persisted custom model pack from settings during TUI startup',
  testName: 'boots with the persisted active custom model pack defaults',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
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
          plan: 'startup-restore-e2e/plan-model',
          build: 'startup-restore-e2e/build-model',
          fast: 'startup-restore-e2e/fast-model',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: packId,
      modeDefaults: {
        plan: 'stale-mode-defaults/plan',
        build: 'stale-mode-defaults/build',
        fast: 'stale-mode-defaults/fast',
      },
      subagentModels: {
        explore: 'startup-restore-e2e/fast-model',
        plan: 'startup-restore-e2e/plan-model',
        execute: 'startup-restore-e2e/build-model',
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/▐build▌startup-restore-e2e\/build-model/i, terminal, 8_000);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Startup Restore E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/build\s+→\s+startup-restore-e2e\/build-model/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    terminal.submit(
      '!node -e \'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("STARTUP_ACTIVE="+s.models.activeModelPackId); console.log("STARTUP_DEFAULT_PLAN="+s.models.modeDefaults.plan); console.log("STARTUP_DEFAULT_BUILD="+s.models.modeDefaults.build); console.log("STARTUP_DEFAULT_FAST="+s.models.modeDefaults.fast); console.log("STARTUP_PACKS="+s.customModelPacks.map(p=>p.name).join("|"));\'',
    );
    await runtime.waitForScreenText(/STARTUP_ACTIVE=custom:Startup Restore E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/STARTUP_DEFAULT_PLAN=stale-mode-defaults\/plan/i, terminal, 8_000);
    await runtime.waitForScreenText(/STARTUP_DEFAULT_BUILD=stale-mode-defaults\/build/i, terminal, 8_000);
    await runtime.waitForScreenText(/STARTUP_DEFAULT_FAST=stale-mode-defaults\/fast/i, terminal, 8_000);
    await runtime.waitForScreenText(/STARTUP_PACKS=Startup Restore E2E/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
