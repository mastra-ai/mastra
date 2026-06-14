import type { McE2eScenario } from './types.js';

export const settingsApiKeysNavigationScenario = {
  name: 'settings-api-keys-navigation',
  description: 'Exercises the Settings API Keys submenu entry through the real TUI.',
  testName: 'opens API key management from Settings',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);
    terminal.submit('/settings');

    await runtime.waitForScreenText(/Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);

    for (let i = 0; i < 7; i++) {
      terminal.write('\x1b[B');
    }
    terminal.write('\r');

    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);
    await runtime.waitForScreenText(/No key configured\. Press Enter to add one\.|Enter add\/update/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
