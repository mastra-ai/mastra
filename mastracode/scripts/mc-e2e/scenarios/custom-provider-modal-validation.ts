import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const existingProviderName = 'Existing Modal E2E';
const createdProviderName = 'Created Modal E2E';

export const customProviderModalValidationScenario = {
  name: 'custom-provider-modal-validation',
  description: 'validates custom provider create, duplicate, invalid URL, and remove-model modal branches through the real TUI',
  testName: 'validates custom provider modal errors and persistence',
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
    settings.customProviders = [
      {
        name: existingProviderName,
        url: 'http://127.0.0.1:43213/v1',
        apiKey: 'sk-existing-modal-e2e',
        models: ['remove-me-e2e'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Existing Modal E2E/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom provider name/i, terminal, 8_000);
    terminal.write(`${existingProviderName}\r`);
    await runtime.waitForScreenText(/Provider already exists: Existing Modal E2E/i, terminal, 8_000);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom provider name/i, terminal, 8_000);
    terminal.write('Invalid URL Modal E2E\r');
    await runtime.waitForScreenText(/Base URL \(OpenAI-compatible endpoint\)/i, terminal, 8_000);
    terminal.write('not-a-url\r');
    await runtime.waitForScreenText(/Invalid URL\. Use a full http\(s\) URL\./i, terminal, 8_000);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom provider name/i, terminal, 8_000);
    terminal.write(`${createdProviderName}\r`);
    await runtime.waitForScreenText(/Base URL \(OpenAI-compatible endpoint\)/i, terminal, 8_000);
    terminal.write('https://created-modal.example.test/v1\r');
    await runtime.waitForScreenText(/API key/i, terminal, 8_000);
    terminal.write('sk-created-modal-e2e\r');
    await runtime.waitForScreenText(/Manage provider: Created Modal E2E/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.sleep(200);
    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Existing Modal E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Remove model/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Remove model from Existing Modal E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/remove-me-e2e/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Removed model: existing-modal-e2e\/remove-me-e2e/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const existing=s.customProviders.find(p=>p.name==="${existingProviderName}"); const created=s.customProviders.find(p=>p.name==="${createdProviderName}"); console.log("CUSTOM_MODAL_PROVIDER_COUNT="+s.customProviders.length); console.log("CUSTOM_MODAL_EXISTING_MODELS="+existing.models.join("|")); console.log("CUSTOM_MODAL_CREATED="+[created.name,created.url,created.apiKey].join("|"));'`,
    );
    await runtime.waitForScreenText(/CUSTOM_MODAL_PROVIDER_COUNT=2/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_MODAL_EXISTING_MODELS=/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /CUSTOM_MODAL_CREATED=Created Modal E2E\|https:\/\/created-modal\.example\.test\/v1\|sk-created-modal-e2e/i,
      terminal,
      8_000,
    );

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
} satisfies McE2eScenario;
