import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

const shellCommand = `node -e "let i=0; const t=setInterval(() => { console.log('mc-shell-line-' + String(i).padStart(3, '0')); if (++i === 22) clearInterval(t); }, 100)"`;

export const shellPassthroughLongOutputScenario: McE2eScenario = {
  name: 'shell-passthrough-long-output',
  description: 'Verify long-running shell passthrough streams, collapses, and expands in the real TUI.',
  testName: 'streams long shell passthrough output before completion and supports Ctrl+E expansion',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit(`!${shellCommand}`);

    await runtime.waitForScreenText(/mc-shell-line-005/i, terminal, 5_000);
    await runtime.waitForScreenText(/mc-shell-line-000/i, terminal, 5_000);
    expect(terminal.serialize().view).not.toMatch(/mc-shell-line-021/i);
    runtime.printScreen('while shell passthrough is streaming', terminal);

    await runtime.waitForScreenText(/mc-shell-line-021/i, terminal, 8_000);
    await runtime.waitForScreenText(/\.\.\. 2 more lines \(Ctrl\+E to expand\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/✓/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/mc-shell-line-000/i);
    runtime.printScreen('after collapsed shell passthrough', terminal);

    terminal.write('\x05');
    await runtime.waitForScreenText(/mc-shell-line-000/i, terminal, 8_000);
    await runtime.waitForScreenText(/mc-shell-line-021/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/Ctrl\+E to expand/i);
    runtime.printScreen('after expanded shell passthrough', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
