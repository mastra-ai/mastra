import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const packName = 'Missing Key Prompt E2E';
const selectedModel = '302ai/keyprompt-e2e-model';
const apiKey = 'sk-model-selection-key-e2e';

export const modelSelectionApiKeyPromptScenario = {
  name: 'model-selection-api-key-prompt',
  description:
    'prompts for a missing provider API key from the real TUI model selector and persists the selected custom pack edit',
  testName: 'stores a missing provider key from model selection and saves the edited pack',
  env() {
    return {
      '302AI_API_KEY': '',
    };
  },
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
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          plan: 'anthropic/claude-sonnet-4-5',
          build: 'anthropic/claude-sonnet-4-5',
          fast: 'anthropic/claude-sonnet-4-5',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Missing Key Prompt E2E/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Missing Key Prompt E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Edit\s+Update this pack/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Edit custom pack: Missing Key Prompt E2E/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Select model for plan mode/i, terminal, 8_000);
    await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);

    terminal.write(selectedModel);
    await runtime.waitForScreenText(/Use: 302ai\/keyprompt-e2e-model/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    await runtime.waitForScreenText(/Enter an API key for 302ai:/i, terminal, 8_000);
    await runtime.waitForScreenText(/302AI_API_KEY/i, terminal, 8_000);
    terminal.write(apiKey);
    await runtime.waitForScreenText(/\*\*\*\*/i, terminal, 8_000);
    if (terminal.serialize().view.includes(apiKey)) {
      throw new Error('API key prompt leaked the raw key value');
    }
    terminal.write('\r');

    await runtime.waitForScreenText(/Edit custom pack: Missing Key Prompt E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai\/keyprompt-e2e-model/i, terminal, 8_000);

    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/302ai\/keyprompt-e2e-model/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const settings=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const auth=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const pack=settings.customModelPacks.find(p=>p.name==="${packName}"); console.log("MODEL_PROMPT_PLAN="+pack.models.plan); console.log("MODEL_PROMPT_KEY="+(auth["apikey:302ai"]?.key || "missing"));'`,
    );
    await runtime.waitForScreenText(/MODEL_PROMPT_PLAN=302ai\/keyprompt-e2e-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODEL_PROMPT_KEY=sk-model-selection-key-e2e/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
