import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const apiKeyPromptScenario: McE2eScenario = {
  name: 'api-key-prompt',
  description: 'Exercise API key masked input through the real TUI.',
  testName: 'masks API key entry and saves the raw value through the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/api-keys');
    await runtime.waitForScreenText(/API Keys/i, terminal);
    await runtime.waitForScreenText(/No key configured\. Press Enter to add one\.|Enter add\/update/i, terminal);
    runtime.printScreen('after /api-keys', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/API Key Required/i, terminal);
    await runtime.waitForScreenText(/Enter an API key for/i, terminal);
    runtime.printScreen('after provider select', terminal);

    const secret = 'mc-e2e-secret-key';
    terminal.write(secret);
    await runtime.sleep(500);
    const maskedScreen = terminal.serialize().view;
    expect(maskedScreen).not.toContain(secret);
    expect(maskedScreen).toMatch(/\*{17}/);
    runtime.printScreen('after masked input', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/302ai\s+✓ \(stored\)|Key stored locally/i, terminal);
    runtime.printScreen('after save', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
