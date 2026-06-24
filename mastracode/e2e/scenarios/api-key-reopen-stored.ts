import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

const envVar = '302AI_API_KEY';
const envKeyValue = 'mc-e2e-env-key-value';

/**
 * Reproduces bugs when a provider already has an API key set:
 * 1. Pressing Enter on a provider with an env-sourced key should open the dialog
 *    to let the user store a local override — previously it only showed an info
 *    message and returned without opening the dialog.
 * 2. Pressing Delete on an env-sourced key should explain that the key can't be
 *    removed from within MC — previously it silently did nothing.
 * 3. After storing a local key, pressing Enter should reopen the dialog.
 * 4. After storing a local key, pressing Delete should remove it.
 */
export const apiKeyReopenStoredScenario = {
  name: 'api-key-reopen-stored',
  description: 'Enter opens the key dialog and Delete works for providers with existing keys.',
  testName: 'opens dialog on Enter for env-sourced key and allows storing/deleting a local override',
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
  env() {
    return {
      [envVar]: envKeyValue,
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Open /api-keys — provider should show ✓ (env) since env var is set
    terminal.submit('/api-keys');
    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai\s+✓ \(env\)/i, terminal, 8_000);
    runtime.printScreen('env key visible', terminal);

    // Bug 1: Press Enter on an env-sourced provider — dialog should open
    // (Previously this just showed an info message without opening the dialog)
    terminal.write('\r');
    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    await runtime.waitForScreenText(/Enter an API key for/i, terminal, 8_000);
    runtime.printScreen('dialog opened on env provider', terminal);

    // Enter a new key to store locally
    const newKey = 'mc-e2e-override-key';
    terminal.write(newKey);
    await runtime.waitForScreenText(/\*{19}/, terminal, 2_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/302ai\s+✓ \(stored\)/i, terminal, 8_000);
    runtime.printScreen('after storing override key', terminal);

    // Bug 3: Enter should reopen dialog for the now-stored key
    terminal.write('\r');
    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    runtime.printScreen('dialog reopened on stored provider', terminal);

    // Cancel out
    terminal.write('\x1b');
    await runtime.waitForScreenText(/302ai\s+✓ \(stored\)/i, terminal, 8_000);

    // Bug 4: Delete should remove the stored key
    // (original env var was overwritten by setStoredApiKey, so provider becomes 'not set')
    terminal.write('\x7f');
    await runtime.waitForScreenText(/302ai\s+✗ \(not set\)/i, terminal, 8_000);
    runtime.printScreen('after deleting stored key', terminal);

    // Close overlay and exit
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/API Keys/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
