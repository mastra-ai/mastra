import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const apiKey = 'sk-browser-model-picker-e2e';

/**
 * Covers choosing the model Stagehand uses for browser AI operations through
 * the real picker: provider filtering, API key prompting, persistence, and
 * rejection of providers Stagehand cannot resolve.
 */
export const browserModelPickerScenario = {
  name: 'browser-model-picker',
  description: 'Selects the Stagehand browser model through the real model picker and rejects unsupported providers.',
  testName: 'picks a browser model, prompts for its API key, and refuses providers Stagehand cannot resolve',
  env() {
    return {
      GROQ_API_KEY: '',
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
    settings.browser = {
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // An id whose provider Stagehand cannot resolve is refused up front,
    // rather than failing later when the browser starts.
    terminal.submit('/browser set model 302ai/some-model');
    await runtime.waitForScreenText(/Unsupported model provider: 302ai/i, terminal, 8_000);

    terminal.submit('/browser set model claude-sonnet-4-5');
    await runtime.waitForScreenText(/Use <provider>\/<model>/i, terminal, 8_000);

    // Neither rejection should have written anything.
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("REJECTED_MODEL="+((s.browser.stagehand||{}).model||"missing"));'`,
    );
    await runtime.waitForScreenText(/REJECTED_MODEL=missing/i, terminal, 8_000);

    // Omitting the value opens the picker instead of erroring.
    terminal.submit('/browser set model');
    await runtime.waitForScreenText(/Select Browser Model/i, terminal, 8_000);
    await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);

    // The picker filters to providers Stagehand resolves, but still offers a
    // freely typed id as "Use: <id>", so the validation has to run on select
    // too rather than relying on the filtered list.
    terminal.write('302ai/some-model');
    await runtime.waitForScreenText(/Use: 302ai\/some-model/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Unsupported model provider: 302ai/i, terminal, 8_000);

    terminal.submit('/browser set model');
    await runtime.waitForScreenText(/Select Browser Model/i, terminal, 8_000);

    // groq is a provider Stagehand resolves, but has no key in this run.
    terminal.write('groq/llama-3.3-70b-versatile');
    await runtime.waitForScreenText(/groq\/llama-3\.3-70b-versatile ✗ \(GROQ_API_KEY\)/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    await runtime.waitForScreenText(/Enter an API key for groq:/i, terminal, 8_000);
    terminal.write(apiKey);
    if (terminal.serialize().view.includes(apiKey)) {
      throw new Error('API key prompt leaked the raw key value');
    }
    terminal.write('\r');

    await runtime.waitForScreenText(/Set model = groq\/llama-3\.3-70b-versatile/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const auth=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const b=s.browser.stagehand||{}; console.log("PICKED_MODEL="+(b.model||"missing")); console.log("PICKED_ENV="+(b.env||"missing")); console.log("PICKED_KEY="+((auth["apikey:groq"]||{}).key||"missing"));'`,
    );
    await runtime.waitForScreenText(/PICKED_MODEL=groq\/llama-3\.3-70b-versatile/i, terminal, 8_000);
    await runtime.waitForScreenText(/PICKED_ENV=LOCAL/i, terminal, 8_000);
    await runtime.waitForScreenText(/PICKED_KEY=sk-browser-model-picker-e2e/i, terminal, 8_000);

    // The picker reopens on the current model, and escaping leaves it alone.
    terminal.submit('/browser set model');
    await runtime.waitForScreenText(/Select Browser Model/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Model selection cancelled/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("AFTER_CANCEL_MODEL="+((s.browser.stagehand||{}).model||"missing"));'`,
    );
    await runtime.waitForScreenText(/AFTER_CANCEL_MODEL=groq\/llama-3\.3-70b-versatile/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
