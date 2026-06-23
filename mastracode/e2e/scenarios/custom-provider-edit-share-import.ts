import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const providerName = 'Share Edit E2E';
const packName = 'Share Cancel E2E';
const pack = {
  name: packName,
  models: {
    plan: 'openai/gpt-5.5',
    build: 'openai/gpt-5.5',
    fast: 'openai/gpt-5.4-mini',
  },
};
const sharedPackString = `mastra-pack:${Buffer.from(JSON.stringify(pack), 'utf8').toString('base64')}`;

export const customProviderEditShareImportScenario = {
  name: 'custom-provider-edit-share-import',
  description: 'edits a custom provider and exercises custom pack share plus import cancel through real TUI modals',
  testName: 'edits a custom provider and cancels importing a shared pack collision',
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
        name: providerName,
        url: 'http://127.0.0.1:43210/v1',
        apiKey: 'sk-share-edit-original',
        models: ['plan-model', 'build-model', 'fast-model'],
      },
    ];
    settings.customModelPacks = [
      {
        ...pack,
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    const submitOverDefault = (value: string) => {
      terminal.write('\x1b[3~'.repeat(80));
      terminal.write(`${value}\r`);
    };

    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/messages\s+0\/30k/i, terminal, 8_000);

    terminal.write('/models');
    await runtime.waitForScreenText(/models\s+Switch model pack/i, terminal, 8_000);
    terminal.write('\r\r');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Import Pack/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Paste the shared model pack string/i, terminal, 8_000);
    terminal.write(sharedPackString);
    terminal.write('\r');
    await runtime.waitForScreenText(/A pack named "Share Cancel E2E" already exists/i, terminal, 8_000);
    await runtime.waitForScreenText(/Cancel\s+Abort import/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenTextAbsent(/A pack named "Share Cancel E2E" already exists/i, terminal, 8_000);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share Edit E2E/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Share Edit E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Edit provider/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Provider name/i, terminal, 8_000);
    submitOverDefault('Share Edited E2E');
    await runtime.waitForScreenText(/Base URL/i, terminal, 8_000);
    submitOverDefault('http://127.0.0.1:43299/v1');
    await runtime.waitForScreenText(/API key/i, terminal, 8_000);
    submitOverDefault('sk-share-edit-updated');
    await runtime.waitForScreenText(/Updated custom provider: Share Edited E2E/i, terminal, 8_000);

    terminal.write('/models');
    await runtime.waitForScreenText(/models\s+Switch model pack/i, terminal, 8_000);
    terminal.write('\r\r');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share Cancel E2E/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share\s+Copy to clipboard/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.waitForScreenText(/Share\s+Copy to clipboard/i, terminal, 8_000);
    terminal.write('\r');

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
