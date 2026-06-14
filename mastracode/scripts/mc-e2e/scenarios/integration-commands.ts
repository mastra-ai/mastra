import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const integrationCommandsScenario: McE2eScenario = {
  name: 'integration-commands',
  description: 'Exercise visible integration command status surfaces through the real TUI.',
  testName: 'shows browser and MCP command status feedback in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser:\s+(disabled|enabled)/i, terminal);
    runtime.printScreen('after /browser status', terminal);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/MCP (system not initialized|Servers:)/i, terminal);
    runtime.printScreen('after /mcp status', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
