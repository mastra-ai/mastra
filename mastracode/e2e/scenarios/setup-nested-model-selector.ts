import { typeTextSlowly } from './typing-utils.js';
import type { McE2eScenario } from './types.js';

export const setupNestedModelSelectorScenario: McE2eScenario = {
  name: 'setup-nested-model-selector',
  description: 'Exercise /setup custom pack nested model selector cancellation through the real TUI overlay.',
  testName: 'returns from nested setup model selector to the parent setup overlay after Escape',
  env: () => ({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GOOGLE_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    CEREBRAS_API_KEY: '',
    MASTRA_GATEWAY_API_KEY: '',
    '302AI_API_KEY': 'sk-nested-model-e2e',
  }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/setup');
    await runtime.waitForScreenText(/Welcome to Mastra Code/i, terminal);
    await runtime.waitForScreenText(/Continue/i, terminal);
    runtime.printScreen('setup welcome', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Authentication/i, terminal);
    terminal.write('\x1b');

    await runtime.waitForScreenText(/Model Packs/i, terminal);
    await runtime.waitForScreenText(/Custom/i, terminal);
    runtime.printScreen('model packs', terminal);

    terminal.write('\r');

    await runtime.waitForScreenText(/Name this custom pack/i, terminal);
    await typeTextSlowly(terminal, 'Nested Modal E2E');
    terminal.write('\r');

    await runtime.waitForScreenText(/Select model for plan mode/i, terminal);
    await runtime.waitForScreenText(/Type to search.*Esc cancel/i, terminal);
    runtime.printScreen('nested model selector', terminal);

    terminal.write('\x1b');
    await runtime.waitForScreenText(/Observational Memory/i, terminal);
    runtime.printScreen('returned to setup overlay', terminal);

    const afterCancel = terminal.serialize().view;
    if (/Select model for plan mode/i.test(afterCancel)) {
      throw new Error('Expected nested model selector overlay to be hidden after Escape');
    }

    terminal.write('\x1b');
    await runtime.waitForScreenText(/Tool Approval/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    const afterSetup = terminal.serialize().view;
    if (
      /Welcome to Mastra Code|Model Packs|Observational Memory|Tool Approval|Select model for plan mode/i.test(
        afterSetup,
      )
    ) {
      throw new Error('Expected setup overlay to be dismissed after finishing defaults');
    }

    terminal.keyCtrlC();
  },
};
