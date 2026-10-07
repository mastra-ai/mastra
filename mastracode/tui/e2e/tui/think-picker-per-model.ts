import assert from 'node:assert/strict';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

async function openThinkPicker(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime): Promise<string> {
  terminal.submit('/think');
  await runtime.waitForScreenText(/Session override/i, terminal, 8_000);
  await runtime.waitForScreenText(/Reasoning disabled/i, terminal, 8_000);
  return terminal.serialize().view;
}

async function closeThinkPicker(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime): Promise<void> {
  terminal.write('\x1b');
  await runtime.waitForScreenTextAbsent(/Session override/i, terminal, 8_000);
}

export const thinkPickerPerModelScenario = {
  name: 'think-picker-per-model',
  description: 'Offers only the thinking levels the selected model runs in /think, and updates them on a model switch.',
  testName: 'hides Max on Claude Haiku 4.5 and offers only Off on GPT-4o',
  env: () => ({
    MASTRACODE_MODEL_ID: 'anthropic/claude-haiku-4-5',
    ANTHROPIC_API_KEY: 'mc-e2e-anthropic-key',
    OPENAI_API_KEY: 'mc-e2e-openai-key',
  }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/▐build▌anthropic\/claude-haiku-4-5/i, terminal, 8_000);

    terminal.submit('/think max');
    await runtime.waitForScreenText(
      /Invalid thinking level: max\. Use one of: off, low, medium, high, xhigh,/i,
      terminal,
    );

    const haikuPicker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Claude Haiku 4.5', terminal);
    assert.match(haikuPicker, /Very High\s+Maximum reasoning depth/);
    assert.doesNotMatch(haikuPicker, /Unbounded reasoning/);
    await closeThinkPicker(terminal, runtime);

    terminal.submit('/model');
    await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
    terminal.write('openai/gpt-4o');
    await runtime.waitForScreenText(/openai\/gpt-4o/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/▐build▌openai\/gpt-4o▌/, terminal, 8_000);

    const gpt4oPicker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on GPT-4o', terminal);
    assert.match(gpt4oPicker, /none\s+Reasoning disabled/);
    assert.doesNotMatch(gpt4oPicker, /Light reasoning|Balanced reasoning|Deep reasoning/);
    await closeThinkPicker(terminal, runtime);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
