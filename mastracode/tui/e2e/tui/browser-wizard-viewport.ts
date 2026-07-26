import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const browserWizardViewportScenario = {
  name: 'browser-wizard-viewport',
  description: 'Sets browser viewport to a fixed size, match-window, and clears it back to the default.',
  testName: 'persists browser viewport through /browser set and clear commands',
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
      provider: 'agent-browser',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Fixed viewport: set echoes the size, and status reads it back from saved settings.
    terminal.submit('/browser set viewport 1440x900');
    await runtime.waitForScreenText(/Set viewport = 1440x900/i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+1440x900/i, terminal, 8_000);

    // Match window: set echoes "match window", status renders it back.
    terminal.submit('/browser set viewport window');
    await runtime.waitForScreenText(/Set viewport = match window/i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+match window/i, terminal, 8_000);

    // Clear back to the default fixed viewport.
    terminal.submit('/browser clear viewport');
    await runtime.waitForScreenText(/Cleared viewport\. Run \/browser on to apply\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+1280x720/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
