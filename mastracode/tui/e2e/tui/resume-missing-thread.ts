import type { McE2eScenario } from './types.js';

export const resumeMissingThreadScenario: McE2eScenario = {
  name: 'resume-missing-thread',
  description: 'Starts a new thread with a visible error when the requested resume thread does not exist.',
  testName: 'explains a missing resume thread instead of crashing',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({ tui: { resumeThreadId: 'thread-mc-e2e-does-not-exist' } });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Thread not found: thread-mc-e2e-does-not-exist/i, terminal, 15_000);
    await runtime.waitForScreenText(/use \/threads to pick an existing one/i, terminal, 5_000);
    runtime.printScreen('missing resume thread', terminal);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Pending new thread: yes/i, terminal, 10_000);
    terminal.keyCtrlC();
  },
};
