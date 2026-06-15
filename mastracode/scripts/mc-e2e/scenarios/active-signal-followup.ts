import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const activeSignalFollowupScenario: McE2eScenario = {
  name: 'active-signal-followup',
  projectFixture: 'long-branch',
  description: 'Send a real TUI follow-up while an AIMock-backed run is active and verify signal delivery.',
  testName: 'accepts a while-active follow-up as an agent signal in the real TUI',
  terminalBackend: 'subprocess',
  useOpenAIModel: true,
  aimockFixture: 'active-signal-followup.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.write('Start a slow active signal run.');
    await runtime.waitForScreenText(/Start a slow active signal run\./i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Created thread:/i, terminal, 8_000);

    terminal.submit('Steer while active.');
    await runtime.waitForScreenText(/↳ Steer while active\. pending/i, terminal);
    runtime.printScreen('after active follow-up submit', terminal);

    await runtime.waitForScreenText(/Initial signal run completed\./i, terminal, 30_000);
    await runtime.waitForScreenText(/Active signal follow-up completed\./i, terminal, 30_000);
    runtime.printScreen('after active follow-up response', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const bodies = requests.map((request: any) => request.body);
    const serialized = JSON.stringify(bodies);
    expect(serialized).toContain('<user delivery=\\"message\\">Start a slow active signal run.</user>');
    expect(serialized).toContain('<user delivery=\\"while-active\\">Steer while active.</user>');
    expect(requests).toHaveLength(2);
  },
};
