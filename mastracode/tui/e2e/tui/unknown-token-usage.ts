import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const unknownTokenUsageScenario: McE2eScenario = {
  name: 'unknown-token-usage',
  description: 'Show unknown token counts in the real TUI without confusing them with measured zero.',
  testName: 'renders unknown token usage honestly',
  env: () => ({ MASTRACODE_MODEL_ID: 'openai/gpt-5.6-codex' }),
  inProcessApp: ({ startMastraCodeApp }) =>
    startMastraCodeApp({
      onCreated: ({ session }) => {
        session.setTokenUsage({});
        session.emit({ type: 'usage_update', usage: {} });
      },
    }),
  async run({ terminal, runtime }) {
    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/cost');
    await runtime.waitForScreenText(/Input:\s+unknown tokens/i, terminal);
    await runtime.waitForScreenText(/Output:\s+unknown tokens/i, terminal);
    await runtime.waitForScreenText(/Total:\s+unknown tokens/i, terminal);
    runtime.printScreen('unknown token usage', terminal);

    terminal.keyCtrlC();
  },
};
