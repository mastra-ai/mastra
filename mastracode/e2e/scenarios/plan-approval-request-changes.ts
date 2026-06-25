import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const PLAN_REQUEST_CHANGES_THREAD_ID = 'thread-e2e-plan-request-changes';

function createPlanRequestChangesIdGenerator(): () => string {
  let count = 0;
  return () => (++count === 2 ? PLAN_REQUEST_CHANGES_THREAD_ID : `plan-request-changes-id-${count}`);
}

export const planApprovalRequestChangesScenario: McE2eScenario = {
  name: 'plan-approval-request-changes',
  description:
    'Submit a plan, request changes (immediate abort), resubmit with a diff, then approve — exercising the full revision flow.',
  testName: 'requests changes on an AIMock-driven plan, shows diff on resubmission, then approves',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-request-changes.json',
  inProcessApp: ({ startMastraCodeApp }) =>
    startMastraCodeApp({ config: { idGenerator: createPlanRequestChangesIdGenerator() } }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    // Switch to plan mode
    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    // Submit initial prompt — AIMock returns submit_plan with the initial plan
    terminal.submit('Create a concise plan for the plan request-changes e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Request Changes Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Initial plan for the request-changes e2e test/i, terminal, 10_000);
    await runtime.waitForScreenText(/Approve\s+— switch to Build mode and implement/i, terminal, 10_000);
    await runtime.waitForScreenText(/Request changes\s+— reject and provide feedback via chat/i, terminal, 10_000);

    // Navigate to "Request changes" (3rd option: Down, Down, Enter)
    terminal.write('\x1b[B'); // Down
    terminal.write('\x1b[B'); // Down
    terminal.write('\r'); // Enter

    // Verify rejection UX: status + feedback hint. The run is aborted
    // immediately — no additional LLM call or agent text output.
    await runtime.waitForScreenText(/✗\s+Changes requested/i, terminal, 10_000);
    await runtime.waitForScreenText(/Send a message with your revision feedback/i, terminal, 10_000);

    // Small delay to confirm no model response leaks through after abort
    await runtime.sleep(500);

    // Send revision feedback as a normal chat message (starts a fresh run)
    terminal.submit('Add a testing section with unit and integration tests');

    // AIMock returns revised submit_plan — TUI should show diff, not full plan
    await runtime.waitForScreenText(/Plan: E2E Request Changes Plan/i, terminal, 15_000);
    await runtime.waitForScreenText(/Changes from previous plan:/i, terminal, 15_000);

    // Verify diff contains added lines (new steps that weren't in the initial plan)
    await runtime.waitForScreenText(/Write unit tests/i, terminal, 10_000);
    await runtime.waitForScreenText(/Write integration tests/i, terminal, 10_000);

    // The 3 approval options should appear again below the diff
    await runtime.waitForScreenText(/Approve\s+— switch to Build mode and implement/i, terminal, 10_000);

    // Approve the revised plan (Enter on first option)
    terminal.write('\r');
    await runtime.waitForScreenText(/✓\s+Approved/i, terminal, 10_000);
    await runtime.waitForScreenText(/▐build▌/i, terminal, 10_000);
    await runtime.sleep(1_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(
        `Expected plan request-changes scenario to make at least 2 AIMock requests, received ${requests.length}`,
      );
    }
    const body = JSON.stringify(requests);

    // Verify revised submit_plan call happened (after user feedback)
    if (!body.includes('call_plan_rc_e2e_revised')) {
      throw new Error('Expected AIMock requests to include the revised submit_plan tool call id');
    }

    // Verify the approved tool result was sent back to the model
    if (!body.includes('Plan approved. Proceed with implementation following the approved plan.')) {
      throw new Error('Expected AIMock requests to include the approved submit_plan tool result');
    }
  },
};
