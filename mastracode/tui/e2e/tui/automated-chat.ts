import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const automatedChatScenario: McE2eScenario = {
  name: 'automated-chat',
  description: 'Submit one prompt to real Mastra Code and assert the AIMock-backed model response appears.',
  testName: 'submits an automated chat prompt to real Mastra Code',
  useOpenAIModel: true,
  aimockFixture: 'automated-chat.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, any>;
    settings.models = { ...settings.models, observerModelOverride: 'openai/gpt-5.4-mini' };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Return the configured Mastra Code e2e smoke phrase.');
    await runtime.waitForScreenText(/MC automated chat smoke response/i, terminal);
    await runtime.waitForScreenText(/MC automated chat title/i, terminal, 10_000);
    runtime.printScreen('after automated prompt', terminal);
    expect(terminal.serialize().view.match(/▐build▌/g) ?? []).toHaveLength(1);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Title: MC automated chat title/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
