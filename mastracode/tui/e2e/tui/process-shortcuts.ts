import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const processShortcutsScenario: McE2eScenario = {
  name: 'process-shortcuts',
  description: 'Exercise process shortcut help and Alt+Z undo behavior through the real TUI.',
  testName: 'shows suspend shortcut help and restores cleared input with Alt+Z',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.waitForScreenText(/Keyboard Shortcuts/i, terminal);
    await runtime.waitForScreenText(/Ctrl\+Z\s+Suspend process \(fg to resume\)/i, terminal);
    await runtime.waitForScreenText(/Alt\+Z\s+Undo last clear/i, terminal);
    runtime.printScreen('after /help', terminal);

    terminal.write('mc alt-z undo e2e draft');
    await runtime.waitForScreenText(/mc alt-z undo e2e draft/i, terminal);
    terminal.keyCtrlC();
    await runtime.waitForScreenTextAbsent(/mc alt-z undo e2e draft/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toContain('mc alt-z undo e2e draft');

    terminal.write('\x1bz');
    await runtime.waitForScreenText(/mc alt-z undo e2e draft/i, terminal);
    runtime.printScreen('after Alt-Z undo', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
