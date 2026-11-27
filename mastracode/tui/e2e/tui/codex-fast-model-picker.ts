import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const FAST_MODEL = 'openai/gpt-6.2-sol:fast';

export const codexFastModelPickerScenario = {
  name: 'codex-fast-model-picker',
  description: 'With a ChatGPT sign-in, /model lists a Fast entry for a supported OpenAI model and keeps it selected.',
  testName: 'selects a Codex Fast entry from /model and shows it as current when reopened',
  async prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.models = { ...settings.models, activeModelPackId: null, modeDefaults: {} };
    settings.customModelPacks = [];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const storage = new AuthStorage(join(appDataDir, 'auth.json'));
    await storage.addAccount(
      'openai-codex',
      { access: 'mc-codex-fast-access', refresh: 'mc-codex-fast-refresh', expires: Date.now() + 60 * 60 * 1000 },
      { label: 'Codex Fast E2E' },
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    // Without typing, the current model's Fast entry sits right below it.
    await runtime.waitForScreenText(/→ openai\/(\S+)\s+✓[^\n]*\n[^\n]*?openai\/\1:fast\s/, terminal, 8_000);
    terminal.write('gpt-6.2-sol');
    await runtime.waitForScreenText(/openai\/gpt-6\.2-sol:fast/i, terminal, 8_000);
    terminal.write(':fast');
    await runtime.waitForScreenText(/→ openai\/gpt-6\.2-sol:fast/i, terminal, 8_000);
    if (terminal.serialize().view.includes(`Use: ${FAST_MODEL}`)) {
      throw new Error('Expected the Fast entry to come from the model list, not the free-form Use entry');
    }
    terminal.write('\r');
    await runtime.waitForScreenTextAbsent(/Select Model/i, terminal, 8_000);

    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /→ openai\/gpt-6\.2-sol:fast\s+✓[^\n]*\n[^\n]*?openai\/gpt-6\.2-sol\s/i,
      terminal,
      8_000,
    );
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Select Model/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("CODEX_FAST_SAVED="+JSON.stringify(s.customModelPacks).includes("gpt-6.2-sol:fast"));'`,
    );
    await runtime.waitForScreenText(/CODEX_FAST_SAVED=true/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
