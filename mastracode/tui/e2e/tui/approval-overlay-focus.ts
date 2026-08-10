import stripAnsi from 'strip-ansi';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

// Regression scenario for #21139: a plan approval arriving while the /models
// overlay is open must not steal focus from the overlay (symptom 1) and must
// not deadlock it (symptom 2). The overlay stays operable, Escape closes it,
// and the pending approval then receives focus so Enter approves the plan.
//
// Determinism: the second model turn (the one whose tool result belongs to the
// plan write_file call, i.e. the turn that emits submit_plan) is held behind a
// gate until run() has opened the /models overlay. That pins the approval's
// arrival inside the overlay-open window without racing AIMock's near-instant
// responses.

let releaseSubmitPlanTurn: () => void;
let submitPlanTurnGate: Promise<void>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return '';
}

async function waitForScreenGone(terminal: any, pattern: RegExp, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const view = stripAnsi(terminal.serialize().view);
    if (!pattern.test(view)) return;
    if (Date.now() > deadline) {
      throw new Error(`Expected ${pattern} to leave the screen (overlay deadlocked?):\n${view}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export const approvalOverlayFocusScenario = {
  name: 'approval-overlay-focus',
  description:
    'Plan approval arriving while the /models overlay is open defers focus: the overlay stays operable and the approval takes focus after it closes.',
  testName: 'keeps the /models overlay operable when a plan approval arrives and hands focus off on close',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-handoff.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    submitPlanTurnGate = new Promise<void>(resolve => {
      releaseSubmitPlanTurn = resolve;
    });

    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const url = requestUrl(input);
      if (!url.includes('/chat/completions') && !url.includes('/responses')) return originalFetch(input, init);

      // The submit_plan turn carries the tool result of the plan write_file
      // call. Hold it until the /models overlay is open on screen.
      const rawBody = requestBodyText(init?.body);
      if (rawBody.includes('call_plan_approval_e2e_write')) {
        await submitPlanTurnGate;
      }
      return originalFetch(input, init);
    });

    try {
      const app = await startMastraCodeApp({
        config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
      });
      return {
        stop: () => {
          // Never leave a fetch parked on the gate if run() failed before
          // releasing it; a held promise would hang teardown.
          releaseSubmitPlanTurn();
          return patches.stopApp(app.stop);
        },
      };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    terminal.submit('Create a concise implementation plan for the plan approval e2e test.');

    // Open the model pack selector while the plan run is in flight; the
    // submit_plan turn is gated until this overlay is visible.
    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 10_000);

    releaseSubmitPlanTurn();

    // Let the approval arrive behind the overlay, then confirm the overlay is
    // still on screen (it must not be dismissed or repainted away).
    await runtime.sleep(3_000);
    const withApproval = stripAnsi(terminal.serialize().view);
    if (!/Switch model pack/i.test(withApproval)) {
      throw new Error(`Expected the /models overlay to remain open when the approval arrived:\n${withApproval}`);
    }

    // Symptom 1: arrow keys must still drive the overlay's selection, not the
    // hidden approval underneath it. Pre-fix, focus was stolen by the approval
    // so the selector highlight never moved.
    // First pin the starting highlight so the "gone" check below cannot pass
    // vacuously. Note this makes the scenario row-sensitive: in the harness
    // environment no provider pack precedes Custom, so Custom is row one; a
    // local run with provider keys detected would fail loudly here rather
    // than pass vacuously below.
    await runtime.waitForScreenText(/→\s+Custom\s/i, terminal, 5_000);
    terminal.write('\u001b[B');
    // Assert the highlight left the first row rather than naming the landing
    // row.
    await waitForScreenGone(terminal, /→\s+Custom\s/i, 5_000);

    // Escape must close the overlay. Pre-fix, focus was stolen by the hidden
    // approval, so Escape never reaches the overlay and it stays up (deadlock).
    terminal.write('\u001b');
    await waitForScreenGone(terminal, /Switch model pack/i, 5_000);

    // With the overlay gone the pending approval takes focus; Enter approves.
    await runtime.waitForScreenText(/Use as \/goal/i, terminal, 10_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/✓\s+Approved/i, terminal, 10_000);

    await runtime.sleep(500);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(`Expected the plan flow to make at least 2 AIMock requests, received ${requests.length}`);
    }
    if (!JSON.stringify(requests).includes('call_plan_approval_e2e_submit')) {
      throw new Error('Expected AIMock requests to include the submit_plan tool call id');
    }
  },
} satisfies McE2eScenario;
