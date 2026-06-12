import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const packName = 'Setup Custom Pack E2E';
const planModel = '302ai/setup-custom-plan-e2e';
const buildModel = '302ai/setup-custom-build-e2e';
const fastModel = '302ai/setup-custom-fast-e2e';
const omModel = '302ai/setup-custom-om-e2e';

export const setupCustomPackCompletionScenario = {
  name: 'setup-custom-pack-completion',
  description: 'Completes /setup through the custom model-pack flow and verifies persisted defaults.',
  testName: 'persists custom model pack choices from setup completion',
  env: () => ({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GOOGLE_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    CEREBRAS_API_KEY: '',
    MASTRA_GATEWAY_API_KEY: '',
    '302AI_API_KEY': 'sk-setup-custom-pack-e2e',
  }),
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      modePackId: null,
      omPackId: null,
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      activeOmPackId: null,
      modeDefaults: {},
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
      subagentModels: { explore: 'stale/explore', plan: 'stale/plan', execute: 'stale/execute' },
    };
    settings.customModelPacks = [];
    settings.preferences = { ...settings.preferences, yolo: true };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/setup');
    await runtime.waitForScreenText(/Welcome to Mastra Code/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Authentication/i, terminal);
    terminal.write('\x1b');

    await runtime.waitForScreenText(/Model Packs/i, terminal);
    await runtime.waitForScreenText(/Custom/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Name this custom pack/i, terminal);
    terminal.write(packName);
    await runtime.waitForScreenText(/Setup Custom Pack E2E/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for plan mode/i, terminal, 8_000);
    terminal.write(planModel);
    await runtime.waitForScreenText(/Use: 302ai\/setup-custom-plan-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for build mode/i, terminal, 8_000);
    terminal.write(buildModel);
    await runtime.waitForScreenText(/Use: 302ai\/setup-custom-build-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for fast mode/i, terminal, 8_000);
    terminal.write(fastModel);
    await runtime.waitForScreenText(/Use: 302ai\/setup-custom-fast-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Observational Memory/i, terminal, 8_000);
    await runtime.waitForScreenText(/Custom/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for observational memory/i, terminal, 8_000);
    terminal.write(omModel);
    await runtime.waitForScreenText(/Use: 302ai\/setup-custom-om-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Tool Approval/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customModelPacks.find(p=>p.name==="${packName}"); console.log("SETUP_CUSTOM_DONE="+Boolean(s.onboarding.completedAt)); console.log("SETUP_CUSTOM_PACK="+s.onboarding.modePackId+":"+s.models.activeModelPackId); console.log("SETUP_CUSTOM_MODELS="+[p?.models?.plan,p?.models?.build,p?.models?.fast].join("|")); console.log("SETUP_CUSTOM_DEFAULTS="+[s.models.modeDefaults.plan,s.models.modeDefaults.build,s.models.modeDefaults.fast].join("|")); console.log("SETUP_CUSTOM_OM="+s.onboarding.omPackId+":"+s.models.activeOmPackId+":"+s.models.omModelOverride); console.log("SETUP_CUSTOM_OVERRIDES="+Object.keys(s.models.subagentModels||{}).length+":"+s.preferences.yolo);'`,
    );
    await runtime.waitForScreenText(/SETUP_CUSTOM_DONE=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_PACK=custom:Setup Custom Pack E2E:custom:Setup Custom Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_MODELS=302ai\/setup-custom-plan-e2e\|302ai\/setup-custom-build-e2e\|302ai\/setup-custom-fast-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_DEFAULTS=302ai\/setup-custom-plan-e2e\|302ai\/setup-custom-build-e2e\|302ai\/setup-custom-fast-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_OM=custom:custom:302ai\/setup-custom-om-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_OVERRIDES=0:false/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
} satisfies McE2eScenario;
