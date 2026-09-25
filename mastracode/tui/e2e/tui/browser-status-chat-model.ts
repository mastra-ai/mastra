import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const chatModel = 'anthropic/claude-sonnet-4-5';

export const browserStatusChatModelScenario = {
  name: 'browser-status-chat-model',
  description:
    'With no browser model configured, Stagehand reuses the chat model captured at launch when its provider key is available, and /browser status says so.',
  testName: 'reuses the launch-time chat model for Stagehand and labels it in /browser status',
  env: () => ({
    MASTRACODE_MODEL_ID: chatModel,
    ANTHROPIC_API_KEY: 'mc-e2e-anthropic-key',
  }),
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.browser = {
      enabled: true,
      provider: 'stagehand',
      headless: true,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Model:\s+anthropic\/claude-sonnet-4-5 \(current chat model;/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/Pending changes \(not yet applied\)/i);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
