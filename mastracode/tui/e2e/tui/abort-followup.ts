import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

/**
 * Regression scenario for the abort → follow-up race condition.
 *
 * When the user interrupts a stream (Ctrl+C) and immediately sends a new
 * message, the follow-up must start a fresh run instead of being dispatched
 * onto the dying (aborted) run. Before the fix in `Session.sendSignal`, the
 * signal was silently lost because `isRunning()` was not checked — the stale
 * run id and active-run id made `sendSignal` think the run was still active.
 *
 * This scenario exercises the real TUI flow end-to-end:
 *   1. Submit a prompt that triggers a slow streaming response.
 *   2. Press Ctrl+C to abort the run mid-stream.
 *   3. Submit a follow-up message.
 *   4. Verify the follow-up response appears (proving a new run was started).
 *   5. Verify both prompts reached the provider via `verifyAimockRequests`.
 */
export const abortFollowupScenario: McE2eScenario = {
  name: 'abort-followup',
  description: 'Interrupt a stream with Ctrl+C and send a follow-up message that must start a new run.',
  testName: 'starts a new run for a follow-up message sent after Ctrl+C abort in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'abort-followup.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
    runtime.printScreen('after startup', terminal);

    // 1. Start a slow run.
    terminal.write('Start a slow run that will be interrupted.');
    await runtime.waitForScreenText(/Start a slow run that will be interrupted\./i, terminal);
    terminal.write('\r');
    // Wait for the stream to actually start so we're interrupting mid-run.
    await runtime.waitForScreenText(/Initial run text/i, terminal, 15_000);
    runtime.printScreen('mid-stream before abort', terminal);

    // 2. Abort the run mid-stream.
    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
    // Wait for the abort to be processed and the terminal to return to idle.
    await runtime.waitForScreenText(/Interrupted/i, terminal, 10_000);
    await runtime.sleep(1_000);

    // 3. Send a follow-up message immediately after abort.
    terminal.write('Follow-up after abort.');
    await runtime.waitForScreenText(/Follow-up after abort\./i, terminal);
    await terminal.flushInput?.();
    await runtime.sleep(200);
    terminal.write('\r');
    runtime.printScreen('after follow-up submit', terminal);

    // 4. Verify the follow-up response renders — this only happens if a new
    //    run was started. If the signal was dispatched onto the dying run,
    //    no response would appear and this would time out.
    await runtime.waitForScreenText(/Follow-up after abort completed successfully\./i, terminal, 60_000);
    runtime.printScreen('after follow-up response', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after final Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    // Both the initial prompt and the follow-up prompt must have reached the
    // provider as two separate runs. If the follow-up signal was lost on the
    // dying run, only one request would have been made.
    expect(requests).toHaveLength(2);

    const serializedBodies = requests.map(request => JSON.stringify((request as { body?: unknown }).body));

    // The first request carries only the initial prompt (no follow-up yet).
    expect(serializedBodies[0]).toContain('Start a slow run that will be interrupted.');

    // The second request is the follow-up run. It includes the prior turn in
    // its message history, so it also references the initial prompt — what
    // proves a new run started is that the follow-up text is present here.
    expect(serializedBodies[1]).toContain('Follow-up after abort.');
  },
};
