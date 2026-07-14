import type { McE2eScenario } from './types.js';

export const promptQueueInterleaveScenario: McE2eScenario = {
  name: 'prompt-queue-interleave',
  description: 'Exercise queued ask_user and request_access prompts emitted by parallel tool calls.',
  testName: 'answers queued ask_user and request_access prompts sequentially in the real TUI',
  skipReason: 'current main no longer renders the request_access granted confirmation after queued prompt approval',
  useOpenAIModel: true,
  aimockFixture: 'prompt-queue-interleave.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);

    terminal.submit('Trigger queued interactive prompts in parallel.');
    await runtime.waitForScreenText(/Answer the first queued prompt\?/i, terminal);
    await runtime.waitForScreenText(/Enter to submit · Shift\+Enter\/\\\+Enter for new line · Esc to skip/i, terminal);
    runtime.printScreen('first prompt active', terminal);

    terminal.write('first prompt answered');
    terminal.write('\r');

    await runtime.waitForScreenText(/✓\s+first prompt answered/i, terminal);
    await runtime.waitForScreenText(/Grant sandbox access to "\/tmp\/mastracode-prompt-queue-e2e"\?/i, terminal);
    await runtime.waitForScreenText(
      /Reason: Verify queued access prompts activate after ask_user is answered\./i,
      terminal,
    );
    await runtime.waitForScreenText(/Yes.*Allow access to this directory/i, terminal);
    runtime.printScreen('queued access prompt active', terminal);

    terminal.write('\r');

    await runtime.waitForScreenText(/Access granted: "\/tmp\/mastracode-prompt-queue-e2e"/i, terminal);
    await runtime.waitForScreenText(/request_access path="\/tmp\/mastracode-prompt-queue-e2e".*✓/i, terminal);
    await runtime.waitForScreenText(/Prompt queue interleave e2e complete\./i, terminal);
    runtime.printScreen('after queued prompts answered', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
