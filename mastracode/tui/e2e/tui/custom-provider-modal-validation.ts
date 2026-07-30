import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const existingProviderName = 'Existing Modal E2E';
const createdProviderName = 'Created Modal E2E';

type CustomProviderSettings = {
  onboarding: Record<string, unknown>;
  customProviders: Array<{ name: string; url: string; apiKey: string; models: string[] }>;
};

export const customProviderModalValidationScenario = {
  name: 'custom-provider-modal-validation',
  description:
    'validates custom provider create/remove modal flows and persisted provider settings through the real TUI',
  testName: 'validates custom provider modal persistence',
  env({ appDataDir }) {
    return {
      MC_E2E_CUSTOM_PROVIDER_MODAL_SETTINGS_PATH: join(appDataDir, 'settings.json'),
    };
  },
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as CustomProviderSettings;
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

    terminal.write('/custom-providers\r');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Existing Modal E2E/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom provider name/i, terminal, 8_000);
    terminal.write(`${createdProviderName}\r`);
    await runtime.waitForScreenText(/Base URL \(OpenAI-compatible endpoint\)/i, terminal, 8_000);
    terminal.write('https://created-modal.example.test/v1\r');
    await runtime.waitForScreenText(/API key/i, terminal, 8_000);
    terminal.write('sk-created-modal-e2e\r');
    await runtime.waitForScreenText(/Manage provider: Created Modal E2E/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage provider: Created Modal E2E/i, terminal, 8_000);

    terminal.write('/custom-providers\r');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Existing Modal E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Created Modal E2E/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Existing Modal E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Remove model/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Remove model from Existing Modal E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/remove-me-e2e/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Removed model: existing-modal-e2e\/remove-me-e2e/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage provider: Existing Modal E2E/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Custom providers/i, terminal, 8_000);

    const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
      (config: { scenarioName?: string }) => config.scenarioName === 'custom-provider-modal-validation',
    ) as { env?: Record<string, string | null> } | undefined;
    const settingsPath = runConfig?.env?.MC_E2E_CUSTOM_PROVIDER_MODAL_SETTINGS_PATH;
    if (!settingsPath) throw new Error('Expected custom provider modal settings path in run config');
    const persistedSettings = JSON.parse(readFileSync(settingsPath, 'utf8')) as CustomProviderSettings;
    const existing = persistedSettings.customProviders.find(
      (provider: { name?: string }) => provider.name === existingProviderName,
    );
    const created = persistedSettings.customProviders.find(
      (provider: { name?: string }) => provider.name === createdProviderName,
    );
    if (persistedSettings.customProviders.length !== 2) {
      throw new Error(`Expected 2 custom providers, got ${persistedSettings.customProviders.length}`);
    }
    if (!existing) throw new Error(`Expected existing provider ${existingProviderName} to persist`);
    if (!created) throw new Error(`Expected created provider ${createdProviderName} to persist`);
    if (existing.models.length !== 0)
      throw new Error(`Expected existing provider models to be empty, got ${existing.models.join('|')}`);
    if (
      created.name !== createdProviderName ||
      created.url !== 'https://created-modal.example.test/v1' ||
      created.apiKey !== 'sk-created-modal-e2e'
    ) {
      throw new Error(`Unexpected created provider: ${JSON.stringify(created)}`);
    }

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
