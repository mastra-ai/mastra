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

async function switchModel(
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
  provider: string,
  model: string,
): Promise<void> {
  const escapedModel = model.replaceAll('.', '\\.');
  terminal.submit('/model');
  await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
  terminal.write(`${provider}/${model}`);
  await runtime.waitForScreenText(new RegExp(`${provider}/${escapedModel}`, 'i'), terminal, 8_000);
  terminal.write('\r');
  await runtime.waitForScreenText(new RegExp(`\\bbuild · (?:${provider}/)?${escapedModel} · `), terminal, 8_000);
}

export const thinkPickerPerModelScenario = {
  name: 'think-picker-per-model',
  description: 'Offers only the thinking levels the selected model runs in /think, and updates them on a model switch.',
  testName:
    'hides Max on Claude Haiku 4.5, offers only Off on GPT-4o and Very High only on the Grok models that list it',
  env: () => ({
    MASTRACODE_MODEL_ID: 'anthropic/claude-haiku-4-5',
    ANTHROPIC_API_KEY: 'mc-e2e-anthropic-key',
    OPENAI_API_KEY: 'mc-e2e-openai-key',
    XAI_API_KEY: 'mc-e2e-xai-key',
  }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/\bbuild · (?:anthropic\/)?claude-haiku-4-5 · /i, terminal, 8_000);

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

    await switchModel(terminal, runtime, 'openai', 'gpt-4o');

    const gpt4oPicker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on GPT-4o', terminal);
    assert.match(gpt4oPicker, /none\s+Reasoning disabled/);
    assert.doesNotMatch(gpt4oPicker, /Light reasoning|Balanced reasoning|Deep reasoning/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.6');
    const grok46Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.6', terminal);
    assert.match(grok46Picker, /Very High\s+Maximum reasoning depth/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.5');
    const grok45Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.5', terminal);
    assert.match(grok45Picker, /Very High\s+Maximum reasoning depth/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.20-0309-reasoning');
    const grok420Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.20 without reasoning controls', terminal);
    assert.match(grok420Picker, /none\s+Reasoning disabled/);
    assert.doesNotMatch(grok420Picker, /Light reasoning|Balanced reasoning|Deep reasoning|Very High/);
    await closeThinkPicker(terminal, runtime);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
