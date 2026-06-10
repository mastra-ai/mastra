import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const modalAndShellScenario: McE2eScenario = {
  name: 'modal-and-shell',
  description: 'Exercise modal overlay cancellation and shell passthrough rendering through the real TUI.',
  testName: 'shows sandbox modal and shell passthrough output in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/sandbox');
    await runtime.waitForScreenText(/Sandbox settings \(no extra paths\)/i, terminal);
    await runtime.waitForScreenText(/Add path/i, terminal);
    runtime.printScreen('after /sandbox modal', terminal);

    terminal.write('\x1b');
    await runtime.sleep(500);
    runtime.printScreen('after sandbox escape', terminal);

    terminal.submit("!printf 'mc shell e2e stdout\\n'");
    await runtime.waitForScreenText(/│\s+mc shell e2e stdout/i, terminal);
    await runtime.waitForScreenText(/\$ printf 'mc shell e2e stdout\\n'.*✓/i, terminal);
    runtime.printScreen('after shell passthrough', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
