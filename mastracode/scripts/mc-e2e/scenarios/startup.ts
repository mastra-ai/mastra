import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const startupScenario: McE2eScenario = {
  name: 'startup',
  description: 'Start real Mastra Code and open /help.',
  testName: 'observe real Mastra Code startup',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.sleep(1_000);
    runtime.printScreen('after /help', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
