import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const visibleCommandsScenario: McE2eScenario = {
  name: 'visible-commands',
  description: 'Exercise visible slash-command UI for help and theme through the real TUI.',
  testName: 'shows help and theme command feedback in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal);
    await runtime.waitForScreenText(/\/api-keys/i, terminal);
    await runtime.waitForScreenText(/Ctrl\+Z|Suspend process/i, terminal);
    runtime.printScreen('after /help', terminal);

    terminal.submit('/theme');
    await runtime.waitForScreenText(/Theme:\s+(dark|light|auto)/i, terminal);
    runtime.printScreen('after /theme', terminal);

    terminal.submit('/theme neon');
    await runtime.waitForScreenText(/Usage:\s+\/theme \[auto\|dark\|light\]/i, terminal);
    runtime.printScreen('after invalid /theme', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
