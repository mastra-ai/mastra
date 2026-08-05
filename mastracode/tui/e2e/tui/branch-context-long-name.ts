import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const branchContextLongNameScenario: McE2eScenario = {
  name: 'branch-context-long-name',
  description: 'Start real Mastra Code in a temp git repo and verify startup plus footer branch context.',
  testName: 'shows live git branch in startup context and preserves abbreviated branch in the footer',
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
    await runtime.waitForScreenText(/feature\/(?:supe\.\.tra-long|su…)/, terminal);
    runtime.printScreen('after branch context assertion', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
