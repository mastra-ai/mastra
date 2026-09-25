import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const setupCompletionPersistenceScenario = {
  name: 'setup-completion-persistence',
  description: 'Completes /setup with API-key provider access and verifies persisted onboarding settings.',
  testName: 'preserves independent explicit OM roles when setup is rerun',
  env: () => ({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GOOGLE_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    CEREBRAS_API_KEY: '',
    MASTRA_GATEWAY_API_KEY: 'mc-e2e-gateway-key',
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
      omPackId: 'custom',
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      activeOmPackId: 'custom',
      modeDefaults: {},
      omModelOverride: 'legacy/shared-model',
      observerModelOverride: 'openai/pinned-observer',
      observerModelSelection: 'openai/pinned-observer',
      reflectorModelOverride: 'anthropic/pinned-reflector',
      reflectorModelSelection: 'anthropic/pinned-reflector',
    };
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
    await runtime.waitForScreenText(/OpenAI/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Tool Approval/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("SETUP_COMPLETED="+Boolean(s.onboarding.completedAt)); console.log("SETUP_SKIPPED="+s.onboarding.skippedAt); console.log("SETUP_MODE="+s.onboarding.modePackId+":"+s.models.activeModelPackId); console.log("SETUP_OM_META="+(s.onboarding.omPackId||"none")+":"+(s.models.activeOmPackId||"none")+":"+(s.models.omModelOverride||"none")); console.log("SETUP_OM_OBSERVER="+(s.models.observerModelSelection||"auto")+":"+(s.models.observerModelOverride||"none")); console.log("SETUP_OM_REFLECTOR="+(s.models.reflectorModelSelection||"auto")+":"+(s.models.reflectorModelOverride||"none")); console.log("SETUP_YOLO="+s.preferences.yolo); console.log("SETUP_CUSTOM_DEFAULTS="+Object.keys(s.models.modeDefaults||{}).length)'`,
    );
    await runtime.waitForScreenText(/SETUP_COMPLETED=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_SKIPPED=null/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_MODE=openai:openai/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_OM_META=custom:custom:legacy\/shared-model/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /SETUP_OM_OBSERVER=openai\/pinned-observer:openai\/pinned-observer/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(
      /SETUP_OM_REFLECTOR=anthropic\/pinned-reflector:anthropic\/pinned-reflector/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/SETUP_YOLO=false/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_CUSTOM_DEFAULTS=0/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
