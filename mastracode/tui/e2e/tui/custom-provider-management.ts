import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const customProviderManagementScenario = {
  name: 'custom-provider-management',
  description: 'manages a configured OpenAI-compatible provider through the real TUI custom-providers modal flow',
  testName: 'adds a model to a custom provider through the real TUI',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.customProviders = [
      {
        name: 'Acme Local',
        url: 'http://127.0.0.1:43210/v1',
        apiKey: 'sk-e2e-custom-provider',
        models: ['__AI_SDK_OPENAI_MODEL_BASE__'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal);
    await runtime.waitForScreenText(/Acme Local/i, terminal);
    await runtime.waitForScreenText(/1 model/i, terminal);
    await runtime.waitForScreenText(/api key set/i, terminal);
    runtime.printScreen('custom providers list', terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Acme Local/i, terminal);
    await runtime.waitForScreenText(/Add model/i, terminal);
    await runtime.waitForScreenText(/Remove model/i, terminal);
    runtime.printScreen('manage provider', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Model ID for Acme Local/i, terminal);
    terminal.write('__AI_SDK_OPENAI_MODEL_REALTIME__');
    await runtime.waitForScreenText(/__AI_SDK_OPENAI_MODEL_REALTIME__/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Added model: acme-local\/__AI_SDK_OPENAI_MODEL_REALTIME__/i, terminal);
    runtime.printScreen('model added', terminal);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Acme Local/i, terminal);
    await runtime.waitForScreenText(/2 models/i, terminal);
    runtime.printScreen('custom providers updated', terminal);
  },
} satisfies McE2eScenario;
