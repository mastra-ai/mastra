import type { McE2eScenario } from './types.js';

export const askUserAdvancedPromptsScenario: McE2eScenario = {
  name: 'ask-user-advanced-prompts',
  description: 'Exercise ask_user multiline, custom-response, and multi-select prompts through the real TUI.',
  testName: 'answers advanced ask_user prompt shapes in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'ask-user-advanced-prompts.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);

    terminal.submit('Exercise advanced ask_user prompts in the TUI.');
    await runtime.waitForScreenText(/Write a two-line e2e answer\?/i, terminal);
    await runtime.waitForScreenText(/Shift\+Enter\/\\\+Enter for new line/i, terminal);
    runtime.printScreen('multiline prompt visible', terminal);

    terminal.write('First ask_user e2e line\\');
    terminal.write('\r');
    terminal.write('Second ask_user e2e line');
    terminal.write('\r');
    await runtime.waitForScreenText(/First ask_user e2e line/i, terminal);
    await runtime.waitForScreenText(/Second ask_user e2e line/i, terminal);
    runtime.printScreen('after multiline answer', terminal);

    await runtime.waitForScreenText(/Choose a deployment target or provide a custom one\?/i, terminal);
    await runtime.waitForScreenText(/Custom response/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Enter to submit · Shift\+Enter\/\\\+Enter for new line · Esc to skip/i, terminal);
    terminal.write('Preview channel');
    terminal.write('\r');
    await runtime.waitForScreenText(/Preview channel/i, terminal);
    runtime.printScreen('after custom response answer', terminal);

    await runtime.waitForScreenText(/Which release tasks should run\?/i, terminal);
    await runtime.waitForScreenText(/Space to toggle · Enter to confirm · Esc to skip/i, terminal);
    await runtime.waitForScreenText(/Docs.*Update documentation/i, terminal);
    await runtime.waitForScreenText(/Release notes.*Prepare notes/i, terminal);
    terminal.write(' ');
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write(' ');
    terminal.write('\r');
    await runtime.waitForScreenText(/Docs/i, terminal);
    await runtime.waitForScreenText(/Release notes/i, terminal);
    await runtime.waitForScreenText(/Ask user advanced prompt e2e complete\./i, terminal);
    runtime.printScreen('after multi-select answer', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
