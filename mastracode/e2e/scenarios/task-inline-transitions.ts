import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const taskInlineTransitionsScenario: McE2eScenario = {
  name: 'task-inline-transitions',
  description: 'Drive task tools through AIMock and verify completed and cleared inline TUI transitions.',
  testName: 'renders completed and cleared task inline transitions from real task tools',
  skipReason: 'current main task tool request shape no longer matches the AIMock inline-transition fixture',
  useOpenAIModel: true,
  aimockFixture: 'task-inline-transitions.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Exercise task inline transitions through real task tools.');

    await runtime.waitForScreenText(/Tasks\s+\[2\/2 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/✓\s+Plan task inline e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/✓\s+Finish task inline e2e/i, terminal, 8_000);

    await runtime.waitForScreenText(/Tasks cleared/i, terminal, 8_000);
    await runtime.waitForScreenText(/Task inline transition e2e complete\./i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 4) {
      throw new Error(
        `Expected task inline transition scenario to make 4 AIMock requests, received ${requests.length}`,
      );
    }
    const serialized = JSON.stringify(requests);
    for (const sentinel of ['call_task_inline_write', 'call_task_inline_complete', 'call_task_inline_clear']) {
      if (!serialized.includes(sentinel)) {
        throw new Error(`Expected AIMock request flow to include ${sentinel}`);
      }
    }
  },
};
