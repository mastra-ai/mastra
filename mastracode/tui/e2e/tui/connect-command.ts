import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const connectCommandScenario = {
  name: 'connect-command',
  description: 'Opens account and API key authentication from one command.',
  testName: 'opens the account or API key selector with /connect',
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
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/connect');
    await runtime.waitForScreenText(/Select authentication method/i, terminal, 8_000);
    await runtime.waitForScreenText(/Sign in with an account/i, terminal, 8_000);
    await runtime.waitForScreenText(/Sign in with an API key/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);
    terminal.write('\x1b');

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
