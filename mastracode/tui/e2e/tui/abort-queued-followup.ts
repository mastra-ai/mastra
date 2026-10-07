import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const CTRL_F = '\x06';
const START_PROMPT = 'Start a slow run before queueing a follow-up.';
const QUEUED_PROMPT = 'Queued follow-up survives abort.';

/**
 * Regression scenario for #25748: a message queued with Ctrl+F while a run is
 * streaming must still be sent after the user interrupts that run with Ctrl+C.
 */
export const abortQueuedFollowupScenario: McE2eScenario = {
  name: 'abort-queued-followup',
  description:
    'Queue a follow-up with Ctrl+F, abort the active run with Ctrl+C, and verify the queued message still runs.',
  testName: 'runs a Ctrl+F queued follow-up after the active run is aborted with Ctrl+C',
  useOpenAIModel: true,
  aimockFixture: 'abort-queued-followup.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.write(START_PROMPT);
    await runtime.waitForScreenText(/Start a slow run before queueing a follow-up\./i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Initial queued run text/i, terminal, 15_000);

    terminal.write(QUEUED_PROMPT);
    await runtime.waitForScreenText(/Queued follow-up survives abort\./i, terminal);
    terminal.write(CTRL_F);
    await runtime.waitForScreenText(/1 queued/i, terminal, 8_000);
    runtime.printScreen('after Ctrl+F queue', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl+C', terminal);

    await runtime.waitForScreenText(/Queued follow-up after abort completed\./i, terminal, 60_000);
    runtime.printScreen('after queued follow-up response', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    expect(requests).toHaveLength(2);
    const bodies = requests.map(request => JSON.stringify((request as { body?: unknown }).body));
    expect(bodies[0]).toContain(START_PROMPT);
    expect(bodies[0]).not.toContain(QUEUED_PROMPT);
    expect(bodies[1]).toContain(QUEUED_PROMPT);
  },
};
