import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const planApprovalRequestChangesScenario: McE2eScenario = {
  name: 'plan-approval-request-changes',
  description:
    'Submit a plan, request changes (immediate abort), resubmit with a diff, then approve — exercising the full revision flow.',
  testName: 'requests changes on an AIMock-driven plan, shows diff on resubmission, then approves',
  useOpenAIModel: true,
  enableObservationalMemory: true,
  enableTitleGeneration: true,
  aimockFixture: 'plan-approval-request-changes.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    // Switch to plan mode
    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/\bplan · /i, terminal, 8_000);

    // Submit initial prompt — AIMock returns submit_plan with the initial plan
    terminal.submit('Create a concise plan for the plan request-changes e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Request Changes Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Initial plan for the request-changes e2e test/i, terminal, 10_000);
    await runtime.waitForScreenText(/Approve\s+switch to Build mode and pursue this plan as a goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Request changes\s+reject and give feedback in chat/i, terminal, 10_000);

    // Navigate to "Request changes" (2nd option: Down, Enter)
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

    // The approval options should appear again below the diff
    await runtime.waitForScreenText(/Approve\s+switch to Build mode and pursue this plan as a goal/i, terminal, 10_000);

    // Approve the revised plan (Enter on first option); it starts as a goal
    terminal.write('\r');
    await runtime.waitForScreenText(/✓\s+Approved/i, terminal, 10_000);
    await runtime.waitForScreenText(/\bbuild · /i, terminal, 10_000);
    await runtime.waitForScreenText(/Goal \(50 max attempts, judge: openai\/gpt-5\.4-mini\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done/i, terminal, 15_000);

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

    // Only the revised plan was approved, so only it is judged as a goal
    const judgeRequests = requests.filter(request =>
      JSON.stringify(request).includes('Goal: # E2E Request Changes Plan'),
    );
    if (judgeRequests.length !== 1) {
      throw new Error(`Expected the revised plan goal to be judged once, judged ${judgeRequests.length} times`);
    }
    if (!JSON.stringify(judgeRequests[0]).includes('Write integration tests for the API.')) {
      throw new Error('Expected the judged goal to be the revised plan');
    }
  },
};
