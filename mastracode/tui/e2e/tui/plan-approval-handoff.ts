import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const planApprovalHandoffScenario: McE2eScenario = {
  name: 'plan-approval-handoff',
  description:
    'Use AIMock submit_plan and approve the inline plan card with no saved judge settings, so the session model judges the plan goal.',
  testName: 'approves an AIMock-driven submit_plan as a goal judged by the session model',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-handoff.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/\bplan · /i, terminal, 8_000);

    terminal.submit('Create a concise implementation plan for the plan approval e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Approval Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Approve\s+switch to Build mode and pursue this plan as a goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Confirm the build-mode acknowledgement renders/i, terminal, 10_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/✓\s+Approved/i, terminal, 10_000);
    await runtime.waitForScreenText(/\bbuild · /i, terminal, 10_000);
    await runtime.waitForScreenText(/Build handoff e2e acknowledged\./i, terminal, 10_000);
    // No judge is saved in settings, so the session model and default max
    // attempts are used without opening the judge picker.
    await runtime.waitForScreenText(/Goal \(50 max attempts, judge: openai\/gpt-5\.4-mini\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done/i, terminal, 15_000);
    if (/Select Goal Judge Model/i.test(terminal.serialize().view)) {
      throw new Error('Plan approval opened the judge picker instead of using the session model');
    }

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(
        `Expected plan approval scenario to make at least 2 AIMock requests, received ${requests.length}`,
      );
    }
    const allRequests = JSON.stringify(requests);
    if (!allRequests.includes('call_plan_approval_e2e_submit')) {
      throw new Error('Expected AIMock requests to include the submit_plan tool call id');
    }
    if (!allRequests.includes('Plan approved. Proceed with implementation following the approved plan.')) {
      throw new Error('Expected AIMock requests to include the approved submit_plan tool result');
    }
    if (allRequests.includes('The user has approved the plan, begin executing.')) {
      throw new Error('Approve should not send the old structured build handoff reminder');
    }
    const judgeRequests = requests.filter(request => JSON.stringify(request).includes('Goal: # E2E Approval Plan'));
    if (judgeRequests.length !== 1) {
      throw new Error(`Expected the plan goal to be judged once, judged ${judgeRequests.length} times`);
    }
  },
};
