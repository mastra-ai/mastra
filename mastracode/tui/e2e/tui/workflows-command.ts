import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const workflowsCommandScenario: McE2eScenario = {
  name: 'workflows-command',
  description: 'Exercise the /workflows management command through the real TUI.',
  testName: 'lists, inspects, runs, and deletes a saved workflow',
  async inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      async onCreated(result) {
        const mastra = result.controller.getMastra();
        if (!mastra) throw new Error('Mastra instance unavailable');
        await mastra.addDynamicWorkflow({
          id: 'e2e-greeting',
          description: 'Create a greeting for a name.',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
          outputSchema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message'],
            additionalProperties: false,
          },
          graph: [
            {
              type: 'mapping',
              id: 'format-greeting',
              mapConfig: { message: { template: 'Hello, ${initData.name}!' } },
            },
          ],
        });
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/workflows help');
    await runtime.waitForScreenText(/Dynamic Workflows — manage chat-built workflows/i, terminal);
    await runtime.waitForScreenText(/To CREATE a workflow, ask the chat in build mode/i, terminal);

    terminal.submit('/workflows list');
    await runtime.waitForScreenText(/e2e-greeting \(active\).*Create a greeting for a name/i, terminal);

    terminal.submit('/workflows show e2e-greeting');
    await runtime.waitForScreenText(/"id": "e2e-greeting"/i, terminal);
    await runtime.waitForScreenText(/format-greeting/i, terminal);

    terminal.submit('/workflows run e2e-greeting {"name":"Ada  Lovelace"}');
    await runtime.waitForScreenText(/Running "e2e-greeting"/i, terminal);
    await runtime.waitForScreenText(/Hello, Ada  Lovelace!/i, terminal);

    terminal.submit('/workflows delete e2e-greeting');
    await runtime.waitForScreenText(/Deleted workflow "e2e-greeting"\./i, terminal);

    terminal.submit('/workflows list');
    await runtime.waitForScreenText(/No saved workflows\. Ask the chat in build mode/i, terminal);
    runtime.printScreen('after workflow lifecycle', terminal);

    terminal.keyCtrlC();
  },
};
