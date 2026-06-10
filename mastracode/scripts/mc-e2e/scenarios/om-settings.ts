import type { McE2eScenario } from './types.js';

export const omSettingsScenario: McE2eScenario = {
  name: 'om-settings',
  description: 'Exercise observational memory settings overlay through the real TUI.',
  testName: 'opens OM settings and toggles caveman observations in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal);
    await runtime.waitForScreenText(/Observer model/i, terminal);
    await runtime.waitForScreenText(/Reflector model/i, terminal);
    await runtime.waitForScreenText(/Observation threshold/i, terminal);
    await runtime.waitForScreenText(/Reflection threshold/i, terminal);
    await runtime.waitForScreenText(/Caveman observations/i, terminal);
    await runtime.waitForScreenText(/Observe attachments/i, terminal);
    runtime.printScreen('after /om', terminal);

    terminal.write('\x1b[B'.repeat(4));
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman-style terse compression/i, terminal);
    await runtime.waitForScreenText(/Standard prose observations/i, terminal);
    runtime.printScreen('after caveman submenu', terminal);

    terminal.write('\x1b[A');
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/Caveman observations\s+On/i, terminal);
    runtime.printScreen('after caveman toggle', terminal);

    terminal.write('\x1b');
    await runtime.sleep(300);
    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal);
    await runtime.waitForScreenText(/Caveman observations\s+On/i, terminal);
    runtime.printScreen('after om reopen', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
