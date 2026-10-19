import assert from 'node:assert/strict';
import type { McE2eScenario } from './types.js';

export const thinkReasoningWarningScenario = {
  name: 'think-reasoning-warning',
  description: 'Warns in /think only when Mastra Code cannot send a thinking level to the selected model.',
  testName: 'shows no thinking warning in /think on DeepSeek V4 Pro',
  env: () => ({
    MASTRACODE_MODEL_ID: 'deepseek/deepseek-v4-pro',
    DEEPSEEK_API_KEY: 'mc-e2e-deepseek-key',
  }),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/\bbuild · (?:deepseek\/)?deepseek-v4-pro · /i, terminal, 8_000);

    terminal.submit('/think');
    await runtime.waitForScreenText(/Session override/i, terminal, 8_000);
    await runtime.waitForScreenText(/Deep reasoning/i, terminal, 8_000);
    runtime.printScreen('/think on DeepSeek V4 Pro', terminal);
    assert.doesNotMatch(terminal.serialize().view, /Warning:/);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Session override/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
