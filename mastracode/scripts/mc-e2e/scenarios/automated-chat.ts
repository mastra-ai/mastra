import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const automatedChatScenario: McE2eScenario = {
  name: 'automated-chat',
  description: 'Submit one prompt to real Mastra Code and assert the AIMock-backed model response appears.',
  testName: 'submits an automated chat prompt to real Mastra Code',
  useOpenAIModel: true,
  aimockFixture: 'automated-chat.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Return the configured Mastra Code e2e smoke phrase.');
    await runtime.waitForScreenText(/MC automated chat smoke response/i, terminal);
    runtime.printScreen('after automated prompt', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
