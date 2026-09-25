import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const configuredModel = 'anthropic/claude-sonnet-4-5';
const pendingModel = 'anthropic/claude-opus-4-1';

export const browserStatusModelScenario = {
  name: 'browser-status-model',
  description:
    'Shows the Stagehand model in /browser status (and /browser info), and reports no pending changes while profile and model match the active browser.',
  testName: 'reports the Stagehand model and only flags drift when the model really changes',
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
      // Short path: the status line must not wrap in the e2e terminal.
      profile: '/tmp/mc-e2e-status-model-profile',
      stagehand: { env: 'LOCAL', model: configuredModel, preserveUserDataDir: true },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Profile + model configured and unchanged since startup: no drift warning.
    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Environment:\s+LOCAL/i, terminal, 8_000);
    await runtime.waitForScreenText(/Model:\s+anthropic\/claude-sonnet-4-5/i, terminal, 8_000);
    await runtime.waitForScreenText(/Profile:\s+\/tmp\/mc-e2e-status-model-profile/i, terminal, 8_000);
    expect(terminal.serialize().view).not.toMatch(/Pending changes \(not yet applied\)/i);

    // `info` is an alias for `status`.
    terminal.submit('/browser info');
    await runtime.waitForScreenText(
      /Model:\s+anthropic\/claude-sonnet-4-5[\s\S]*Model:\s+anthropic\/claude-sonnet-4-5/i,
      terminal,
      8_000,
    );
    expect(terminal.serialize().view).not.toMatch(/Pending changes \(not yet applied\)/i);

    // Changing the model is real drift: active keeps the launch model, pending shows the new one.
    terminal.submit(`/browser set model ${pendingModel}`);
    await runtime.waitForScreenText(/Set model = anthropic\/claude-opus-4-1/i, terminal, 8_000);
    await runtime.waitForScreenText(/Run \/browser on to apply\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser \(active\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/Pending changes \(not yet applied\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/browser on to apply, \/browser to reconfigure, or restart\./i, terminal, 8_000);

    const screen = terminal.serialize().view;
    const activeIndex = screen.search(/Browser \(active\):/i);
    const pendingIndex = screen.search(/Pending changes \(not yet applied\):/i);
    expect(activeIndex).toBeGreaterThan(-1);
    expect(pendingIndex).toBeGreaterThan(activeIndex);
    expect(screen.slice(activeIndex, pendingIndex)).toMatch(/Model:\s+anthropic\/claude-sonnet-4-5/i);
    expect(screen.slice(pendingIndex)).toMatch(/Model:\s+anthropic\/claude-opus-4-1/i);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
