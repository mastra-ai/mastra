import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const workflowsCommandScenario: McE2eScenario = {
  name: 'workflows-command',
  description: 'Exercise the /workflows management command through the real TUI.',
  testName: 'shows workflow management help and the empty stored-workflow state',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/workflows help');
    await runtime.waitForScreenText(/Workflows — manage chat-built static workflows/i, terminal);
    await runtime.waitForScreenText(/To CREATE a workflow, ask the chat in build mode/i, terminal);
    runtime.printScreen('after /workflows help', terminal);

    terminal.submit('/workflows list');
    await runtime.waitForScreenText(/No saved workflows\. Ask the chat in build mode/i, terminal);
    runtime.printScreen('after /workflows list', terminal);

    terminal.keyCtrlC();
  },
};
