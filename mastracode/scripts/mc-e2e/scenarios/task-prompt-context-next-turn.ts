import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const taskPromptContextNextTurnScenario: McE2eScenario = {
  name: 'task-prompt-context-next-turn',
  description: 'Verify live task state is injected into the next user turn system prompt.',
  testName: 'includes current task list in next-turn prompt context after task_write',
  useOpenAIModel: true,
  aimockFixture: 'task-prompt-context-next-turn.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Create a prompt-context e2e task.');

    await runtime.waitForScreenText(/Tasks \[0\/1 completed\]/i, terminal, 10_000);
    await runtime.waitForScreenText(/Verifying current task list prompt context/i, terminal, 10_000);
    await runtime.waitForScreenText(/Task state seeded for prompt-context verification\./i, terminal, 15_000);

    terminal.submit('Confirm current task prompt context.');
    await runtime.waitForScreenText(/Current task prompt context observed\./i, terminal, 15_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 3) {
      throw new Error(`Expected task prompt-context scenario to make 3 AIMock requests, received ${requests.length}`);
    }
    const finalRequest = JSON.stringify(requests[2]);
    for (const needle of [
      '<current-task-list>',
      '{id: prompt-context-e2e}',
      'Verify current task list prompt context',
    ]) {
      if (!finalRequest.includes(needle)) {
        throw new Error(`Expected final AIMock request to include ${needle}`);
      }
    }
  },
};
