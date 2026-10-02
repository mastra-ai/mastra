import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const packName = 'Memory Pack E2E';
const planModel = '302ai/memory-pack-plan-e2e';
const buildModel = '302ai/memory-pack-build-e2e';
const fastModel = '302ai/memory-pack-fast-e2e';
const memoryModel = '302ai/memory-pack-memory-e2e';

export const modelsPackMemoryModelScenario = {
  name: 'models-pack-memory-model',
  description:
    'Creates a custom pack with a memory (OM) model through /models and verifies persistence and detail rendering.',
  testName: 'creates a custom pack with an optional memory model and persists it',
  env: () => ({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GOOGLE_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    CEREBRAS_API_KEY: '',
    MASTRA_GATEWAY_API_KEY: '',
    '302AI_API_KEY': 'sk-models-pack-memory-e2e',
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
    settings.customModelPacks = [];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
    };
    settings.preferences = { ...settings.preferences, yolo: true };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    // With no built-in provider keys configured, the "Custom" pseudo-row is the first row.
    await runtime.waitForScreenText(/Custom\s+Choose a model for each mode/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Name this custom pack/i, terminal, 8_000);
    terminal.write(packName);
    await runtime.waitForScreenText(/Memory Pack E2E/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for plan mode/i, terminal, 8_000);
    terminal.write(planModel);
    await runtime.waitForScreenText(/Use: 302ai\/memory-pack-plan-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for build mode/i, terminal, 8_000);
    terminal.write(buildModel);
    await runtime.waitForScreenText(/Use: 302ai\/memory-pack-build-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for fast mode/i, terminal, 8_000);
    terminal.write(fastModel);
    await runtime.waitForScreenText(/Use: 302ai\/memory-pack-fast-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Observational memory model \(optional\)/i, terminal, 8_000);
    // First row is "Choose model…".
    terminal.write('\r');

    await runtime.waitForScreenText(/Select observational memory model/i, terminal, 8_000);
    terminal.write(memoryModel);
    await runtime.waitForScreenText(/Use: 302ai\/memory-pack-memory-e2e/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to Memory Pack E2E pack/i, terminal, 12_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customModelPacks.find(p=>p.name==="${packName}"); console.log("MEMORY_PACK_ACTIVE="+s.models.activeModelPackId); console.log("MEMORY_PACK_MEMORY="+p?.models?.memory); console.log("MEMORY_PACK_DEFAULT_MEMORY="+s.models.modeDefaults.memory);'`,
    );
    await runtime.waitForScreenText(/MEMORY_PACK_ACTIVE=custom:Memory Pack E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/MEMORY_PACK_MEMORY=302ai\/memory-pack-memory-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/MEMORY_PACK_DEFAULT_MEMORY=302ai\/memory-pack-memory-e2e/i, terminal, 8_000);

    // Reopen /models and confirm the pack detail renders the memory row.
    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/memory\s+→\s+302ai\/memory-pack-memory-e2e/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
