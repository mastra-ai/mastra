import type { McE2eScenario } from './types.js';

export const omSettingsScenario: McE2eScenario = {
  name: 'om-settings',
  description: 'Exercise observational memory settings overlay through the real TUI.',
  testName: 'opens OM settings and toggles caveman observations in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/memory');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal);
    await runtime.waitForScreenText(/Observer model/i, terminal);
    await runtime.waitForScreenText(/Reflector model/i, terminal);
    await runtime.waitForScreenText(/Messages before observation/i, terminal);
    await runtime.waitForScreenText(/Observations before reflection/i, terminal);
    await runtime.waitForScreenText(/Caveman observations/i, terminal);
    await runtime.waitForScreenText(/Observe attachments/i, terminal);
    runtime.printScreen('after /memory', terminal);

    terminal.write('\x1b[B'.repeat(2));
    await runtime.waitForScreenText(
      /Message tokens before the Observer runs\. More means a larger message window per\s+observation\./i,
      terminal,
    );
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(
      /Accumulated observation tokens before the Reflector compresses them\. More means less\s+frequent compression\./i,
      terminal,
    );
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman-style terse compression/i, terminal);
    await runtime.waitForScreenText(/Standard prose observations/i, terminal);
    runtime.printScreen('after caveman submenu', terminal);

    terminal.write('\x1b[A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman observations\s+On/i, terminal);
    runtime.printScreen('after caveman toggle', terminal);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);
    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal);
    await runtime.waitForScreenText(/Messages before observation/i, terminal);
    await runtime.waitForScreenText(/Observations before reflection/i, terminal);
    await runtime.waitForScreenText(/Caveman observations\s+On/i, terminal);
    runtime.printScreen('after /om alias reopen', terminal);
  },
};
