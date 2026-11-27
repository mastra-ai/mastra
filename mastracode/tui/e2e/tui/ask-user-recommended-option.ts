import type { McE2eScenario, McE2eTerminal } from './types.js';

function rowWith(terminal: McE2eTerminal, text: string): string {
  const rows = terminal
    .serialize()
    .view.split('\n')
    .filter(row => row.includes(text));
  if (rows.length !== 1) {
    throw new Error(`Expected one row with "${text}", found ${rows.length}\n\n${terminal.serialize().view}`);
  }
  return rows[0]!;
}

export const askUserRecommendedOptionScenario: McE2eScenario = {
  name: 'ask-user-recommended-option',
  description: 'Show the option ask_user marks as recommended, without choosing it for the user.',
  testName: 'tags the recommended ask_user option and leaves the choice to the user',
  useOpenAIModel: true,
  aimockFixture: 'ask-user-recommended-option.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);

    terminal.submit('Ask one ask_user question with a recommended option.');
    await runtime.waitForScreenText(/Where should this release go\?/i, terminal);
    await runtime.waitForScreenText(/Enter to select · Esc to skip/i, terminal);
    await runtime.waitForScreenText(/\(recommended\)/, terminal);
    runtime.printScreen('waiting for an answer', terminal);

    if (!rowWith(terminal, 'Production').includes('(recommended)')) {
      throw new Error('The recommended option is not tagged');
    }
    if (rowWith(terminal, 'Staging').includes('(recommended)')) {
      throw new Error('An option the agent did not recommend is tagged');
    }
    if (!rowWith(terminal, 'Staging').includes('→')) {
      throw new Error('The cursor moved off the first option; the recommendation must not choose for the user');
    }

    // Pick the recommended option. The answered view ticks the option whose label equals the answer,
    // so a tick on Production proves the answer is the bare label, without the tag.
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(/→ Production/, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/✓ Production/, terminal);
    await runtime.waitForScreenText(/Recommended option answer received\./i, terminal, 10_000);
    runtime.printScreen('answered', terminal);
    terminal.keyCtrlC();
  },
};
