import { expect as vitestExpect } from 'vitest';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

/**
 * Regression scenario for the abort → follow-up race condition.
 *
 * When the user interrupts a stream and immediately sends a new message, the
 * follow-up must start a fresh run instead of being dispatched onto the dying
 * (aborted) run. Before the fix in `Session.sendSignal`, the signal was silently
 * lost because `isRunning()` was not checked — the stale run id and active-run
 * id made `sendSignal` think the run was still active.
 *
 * Escape variants cover single-key interruption and follow-up across agent engines.
 */
function createAbortFollowupScenario(
  name: McE2eScenario['name'],
  experimentalAgent: '' | 'durable' | 'evented' = '',
): McE2eScenario {
  const escape = name !== 'abort-followup';
  const key = escape ? 'Escape' : 'Ctrl+C';
  return {
    name,
    description: `Interrupt a stream with ${key} and send a follow-up message that must start a new run.`,
    testName: `starts a new run after one ${key} interrupts the ${experimentalAgent || 'plain'} agent in the real TUI`,
    useOpenAIModel: true,
    aimockFixture: 'abort-followup.json',
    env() {
      return { MASTRACODE_EXPERIMENTAL_AGENT: experimentalAgent };
    },
    async inProcessApp({ startMastraCodeApp }) {
      return startMastraCodeApp({
        onCreated({ codeAgent, controller, session }) {
          vitestExpect(controller.getCurrentAgent(session)).toBe(codeAgent);
          if (experimentalAgent) {
            const workflow = (codeAgent as unknown as { getWorkflow(): { engineType?: string } }).getWorkflow();
            vitestExpect(workflow.engineType).toBe(experimentalAgent === 'evented' ? 'evented' : 'default');
          }
        },
      });
    },
    async run({ terminal, runtime }) {
      runtime.startLiveOutput(terminal);
      runtime.printScreen('spawned', terminal);

      await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();
      runtime.printScreen('after startup', terminal);

      terminal.write('Start a slow run that will be interrupted.');
      await runtime.waitForScreenText(/Start a slow run that will be interrupted\./i, terminal);
      terminal.write('\r');
      await runtime.waitForScreenText(/Initial run text/i, terminal, 15_000);
      runtime.printScreen('mid-stream before abort', terminal);

      if (escape) terminal.write('\x1b');
      else terminal.keyCtrlC();
      runtime.printScreen(`after ${key}`, terminal);
      await runtime.waitForScreenText(/Interrupted/i, terminal, 10_000);
      await runtime.sleep(1_000);

      terminal.write('Follow-up after abort.');
      await runtime.waitForScreenText(/Follow-up after abort\./i, terminal);
      await terminal.flushInput?.();
      await runtime.sleep(200);
      terminal.write('\r');
      runtime.printScreen('after follow-up submit', terminal);

      await runtime.waitForScreenText(/Follow-up after abort completed successfully\./i, terminal, 60_000);
      runtime.printScreen('after follow-up response', terminal);

      terminal.keyCtrlC();
      runtime.printScreen('after final Ctrl-C', terminal);
    },
    verifyAimockRequests(requests) {
      // Two requests prove the follow-up was not lost on the dying run.
      expect(requests).toHaveLength(2);
      const serializedBodies = requests.map(request => JSON.stringify((request as { body?: unknown }).body));
      expect(serializedBodies[0]).toContain('Start a slow run that will be interrupted.');
      expect(serializedBodies[1]).toContain('Follow-up after abort.');
    },
  };
}

export const abortFollowupScenario = createAbortFollowupScenario('abort-followup');
export const abortEscapeOffScenario = createAbortFollowupScenario('abort-escape-off');
export const abortEscapeDurableScenario = createAbortFollowupScenario('abort-escape-durable', 'durable');
export const abortEscapeEventedScenario = createAbortFollowupScenario('abort-escape-evented', 'evented');
