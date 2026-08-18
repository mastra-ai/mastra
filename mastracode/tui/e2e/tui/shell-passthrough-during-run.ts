import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const shellPassthroughDuringRunScenario: McE2eScenario = {
  name: 'shell-passthrough-during-run',
  description: 'Run a ! shell passthrough command while a model run is streaming.',
  testName: 'runs ! shell passthrough locally while a run is active',
  useOpenAIModel: true,
  aimockFixture: 'shell-passthrough-during-run.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);

    terminal.submit('Start a slow shell passthrough run.');
    await runtime.waitForScreenText(/Slow run started/i, terminal, 20_000);
    runtime.printScreen('while streaming', terminal);

    terminal.submit(`!printf '%s\\n' SHELL_DURING_RUN_OK`);
    await runtime.waitForScreenText(/SHELL_DURING_RUN_OK/i, terminal, 10_000);
    await runtime.waitForScreenText(/\$ printf .*✓/i, terminal, 10_000);
    runtime.printScreen('after shell passthrough', terminal);

    await runtime.waitForScreenText(/Slow run finished/i, terminal, 30_000);

    const view = terminal.serialize().view;
    expect(view).not.toContain('steer');

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const steered = requests
      .map(request => JSON.stringify((request as { body?: unknown }).body))
      .filter(body => body.includes('SHELL_DURING_RUN_OK'));
    expect(steered).toHaveLength(0);
  },
};
