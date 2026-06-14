import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const planApprovalHandoffScenario: McE2eScenario = {
  name: 'plan-approval-handoff',
  description: 'Use AIMock submit_plan and approve the inline plan card through the real TUI.',
  testName: 'renders and approves an AIMock-driven submit_plan handoff',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-handoff.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    terminal.submit('Create a concise implementation plan for the plan approval e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Approval Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Approve\s+— switch to Build mode and implement/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use as \/goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Confirm the build-mode acknowledgement renders/i, terminal, 10_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/✓\s+Approved/i, terminal, 10_000);
    await runtime.waitForScreenText(/The user has approved the plan, begin executing\./i, terminal, 10_000);
    await runtime.waitForScreenText(/Build handoff e2e acknowledged\./i, terminal, 15_000);

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
    if (!allRequests.includes('The user has approved the plan, begin executing.')) {
      throw new Error('Expected AIMock requests to include the structured build handoff reminder');
    }
  },
};
