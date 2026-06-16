import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const omPackStartupRestoreScenario: McE2eScenario = {
  name: 'om-pack-startup-restore',
  description: 'Restores a persisted built-in OM pack into observer and reflector model state at startup.',
  testName: 'restores built-in OM pack defaults through /om on startup',
  useOpenAIModel: true,
  aimockFixture: 'om-pack-startup-restore.json',
  env: () => ({
    OPENAI_API_KEY: 'mc-e2e-openai-key',
  }),
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
      activeOmPackId: 'openai',
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('Create OM pack startup restore thread.');
    await runtime.waitForScreenText(/OM pack startup restore thread ready\./i, terminal, 12_000);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+gpt-5\.4-mini/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+gpt-5\.4-mini/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const m=s.models||{}; console.log("OM_PACK_SETTINGS="+[m.activeOmPackId,m.omModelOverride||"null",m.observerModelOverride||"null",m.reflectorModelOverride||"null"].join(":"));'`,
    );
    await runtime.waitForScreenText(/OM_PACK_SETTINGS=openai:null:null:null/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected OM pack startup restore scenario to make 1 AIMock request, received ${requests.length}`);
    }
  },
};
