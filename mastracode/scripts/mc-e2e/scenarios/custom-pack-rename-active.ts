import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const originalName = 'Rename Source E2E';
const renamedName = 'Renamed Active E2E';
const originalPackId = `custom:${originalName}`;
export const customPackRenameActiveScenario = {
  name: 'custom-pack-rename-active',
  description: 'renames an active saved custom model pack through /models and preserves active/onboarding settings',
  testName: 'renames an active custom pack and persists the new active pack id',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      modePackId: originalPackId,
      quietModePreferenceSelected: true,
    };
    settings.customModelPacks = [
      {
        name: originalName,
        models: {
          plan: 'rename-pack-e2e/plan-model',
          build: 'rename-pack-e2e/build-model',
          fast: 'rename-pack-e2e/fast-model',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: originalPackId,
      modeDefaults: {
        plan: 'rename-pack-e2e/plan-model',
        build: 'rename-pack-e2e/build-model',
        fast: 'rename-pack-e2e/fast-model',
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Rename Source E2E/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Rename Source E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Edit\s+Update this pack/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Edit custom pack: Rename Source E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Rename → Rename Source E2E/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Name this custom pack/i, terminal, 8_000);
    terminal.write('\x0b');
    terminal.write(renamedName);
    terminal.write('\r');

    await runtime.waitForScreenText(/Edit custom pack: Renamed Active E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Rename → Renamed Active E2E/i, terminal, 8_000);

    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Renamed Active E2E/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const names=s.customModelPacks.map(p=>p.name).join("|"); const pack=s.customModelPacks.find(p=>p.name==="${renamedName}"); console.log("RENAME_ACTIVE="+s.models.activeModelPackId); console.log("RENAME_ONBOARDING="+s.onboarding.modePackId); console.log("RENAME_NAMES="+names); console.log("RENAME_MODELS="+[pack?.models.plan,pack?.models.build,pack?.models.fast].join("|")); console.log("RENAME_OLD_PRESENT="+s.customModelPacks.some(p=>p.name==="${originalName}"));'`,
    );
    await runtime.waitForScreenText(/RENAME_ACTIVE=custom:Renamed Active E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/RENAME_ONBOARDING=custom:Renamed Active E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/RENAME_NAMES=Renamed Active E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /RENAME_MODELS=rename-pack-e2e\/plan-model\|rename-pack-e2e\/build-model\|rename-pack-e2e\/fast-model/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/RENAME_OLD_PRESENT=false/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
