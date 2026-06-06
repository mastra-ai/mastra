import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const branchContextLongNameScenario: McE2eScenario = {
  name: 'branch-context-long-name',
  description: 'Start real Mastra Code in a temp git repo and verify startup branch context.',
  testName: 'shows live git branch in the Mastra Code startup TUI context',
  projectFixture: 'long-branch',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(
        terminal.getByText(/Branch:\s+feature\/super-long-branch-name-for-status-footer/gi, {
          full: true,
          strict: false,
        }),
      ) as any
    ).toBeVisible();
    runtime.printScreen('after branch context assertion', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
