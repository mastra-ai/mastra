import type { McE2eScenario, McE2eTerminal } from './types.js';

/** Screen row of the status footer, which sits directly under the prompt. */
function footerRow(terminal: McE2eTerminal): number {
  const rows = terminal.serialize().view.split('\n');
  const matches = rows.flatMap((row, index) => (/\bbuild · /.test(row) ? [index] : []));
  if (matches.length !== 1) {
    throw new Error(`Expected one status footer row, found ${matches.length}\n\n${rows.join('\n')}`);
  }
  return matches[0]!;
}

export const askUserAnswerHoldsPromptScenario: McE2eScenario = {
  name: 'ask-user-answer-holds-prompt',
  description: 'Answer an inline ask_user option prompt and assert the prompt below it does not move.',
  testName: 'keeps the prompt in place when an inline ask_user option is selected',
  useOpenAIModel: true,
  aimockFixture: 'ask-user-answer-holds-prompt.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);

    terminal.submit('Ask one ask_user question and hold the reply.');
    await runtime.waitForScreenText(/Pick a rollout target\?/i, terminal);
    await runtime.waitForScreenText(/Enter to select · Esc to skip/i, terminal);
    await runtime.sleep(200);
    runtime.printScreen('waiting for an answer', terminal);
    const before = footerRow(terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/✓ Production/, terminal);
    runtime.printScreen('answered', terminal);
    // The fixture holds the follow-up reply, so nothing else has been added below the card yet.
    const after = footerRow(terminal);
    if (after !== before) {
      throw new Error(`Answering moved the prompt from row ${before + 1} to row ${after + 1}`);
    }

    await runtime.waitForScreenText(/Ask user rollout answer received\./i, terminal, 10_000);
    terminal.keyCtrlC();
  },
};
