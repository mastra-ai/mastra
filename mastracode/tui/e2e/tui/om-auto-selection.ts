import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

export const omAutoSelectionScenario: McE2eScenario = {
  name: 'om-auto-selection',
  description: 'Displays effective auto OM models and resets one explicit role through the real TUI.',
  testName: 'shows and independently resets automatic OM model selection',
  enableObservationalMemory: true,
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
    settings.models = {
      ...settings.models,
      activeModelPackId: 'openai',
      modeDefaults: {
        ...settings.models?.modeDefaults,
        build: 'openai/gpt-5.6-sol',
      },
      activeOmPackId: 'custom',
      omModelOverride: null,
      observerModelOverride: 'custom/pinned-observer',
      observerModelSelection: 'custom/pinned-observer',
      reflectorModelOverride: null,
      reflectorModelSelection: 'auto',
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+pinned-observer/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Observer Model/i, terminal, 8_000);
    await runtime.waitForScreenText(/Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Observer model\s+Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const m=s.models; console.log("OM_AUTO_SELECTION="+m.observerModelSelection+":"+m.reflectorModelSelection+":"+(m.observerModelOverride||"null")+":"+(m.reflectorModelOverride||"null"));'`,
    );
    await runtime.waitForScreenText(/OM_AUTO_SELECTION=auto:auto:null:null/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
};
