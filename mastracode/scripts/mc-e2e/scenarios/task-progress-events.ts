import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const taskProgressEventsScenario: McE2eScenario = {
  name: 'task-progress-events',
  description: 'Use an AIMock task_write tool call and verify real TUI task progress rendering.',
  testName: 'renders task progress from an AIMock-driven task_write tool call',
  useOpenAIModel: true,
  aimockFixture: 'task-progress-events.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Create a visible task list using the task tool.');

    await runtime.waitForScreenText(/Tasks\s+\[1\/2 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Plan task progress e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Verifying task progress e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Task tool progress e2e complete\./i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected task progress scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const second = JSON.stringify(requests[1]);
    if (!second.includes('call_task_progress_e2e_write') || !second.includes('Plan task progress e2e')) {
      throw new Error('Expected second AIMock request to include the task_write tool result');
    }
  },
};
