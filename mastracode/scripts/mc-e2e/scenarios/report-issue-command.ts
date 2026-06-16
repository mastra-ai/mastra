import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const reportIssueCommandScenario: McE2eScenario = {
  name: 'report-issue-command',
  description: 'Exercise /report-issue handoff into an AIMock-backed model response through the real TUI.',
  testName: 'runs report issue command through real TUI and AIMock',
  useOpenAIModel: true,
  aimockFixture: 'report-issue-command.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/report-issue startup hangs');
    await runtime.waitForScreenText(/MC report issue e2e response/i, terminal, 30_000);
    await runtime.waitForScreenText(/mastracode GitHub issue/i, terminal);
    runtime.printScreen('after /report-issue', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
