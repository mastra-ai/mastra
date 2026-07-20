import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const activeSignalFollowupScenario: McE2eScenario = {
  name: 'active-signal-followup',
  projectFixture: 'long-branch',
  description: 'Send a real TUI follow-up while an AIMock-backed run is active and verify signal delivery.',
  testName: 'accepts a while-active follow-up as an agent signal in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'active-signal-followup.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.write('Start a slow active signal run.');
    await runtime.waitForScreenText(/Start a slow active signal run\./i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Initial signal/i, terminal, 15_000);

    terminal.submit('Steer while active.');
    await runtime.waitForScreenText(/Steer while active\./i, terminal);
    runtime.printScreen('after active follow-up submit', terminal);

    await runtime.waitForScreenText(/Active signal follow-up completed\./i, terminal, 60_000);
    runtime.printScreen('after active follow-up response', terminal);

    const completedView = terminal.serialize().view;
    expect(completedView).toContain('Steer while active.');
    expect(completedView).toContain('steer');
    expect(completedView).not.toContain('Steer while active. pending');

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const bodies = requests.map(request => (request as { body?: unknown }).body);
    const serializedBodies = bodies.map(body => JSON.stringify(body));
    const whileActiveRequests = serializedBodies.filter(body =>
      body.includes('<user delivery=\\"while-active\\">Steer while active.</user>'),
    );
    expect(whileActiveRequests).toHaveLength(1);
  },
};
