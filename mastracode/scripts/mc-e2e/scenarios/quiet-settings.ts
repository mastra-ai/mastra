import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const quietSettingsScenario = {
  name: 'quiet-settings',
  description: 'toggles quiet mode and preview-line settings through the real TUI settings overlay',
  testName: 'enables quiet mode and updates preview lines in the real TUI',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = { ...settings.onboarding, quietModePreferenceSelected: true };
    settings.preferences = {
      ...settings.preferences,
      quietMode: false,
      quietModeMaxToolPreviewLines: 2,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Settings/i, terminal);
    await runtime.waitForScreenText(/Quiet mode\s+Off/i, terminal);
    runtime.printScreen('quiet settings initial', terminal);

    terminal.write('\x1b[B'.repeat(4));
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/Keep normal tool and subagent rendering/i, terminal);
    terminal.write('\x1b[A');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Quiet mode\s+On/i, terminal);
    runtime.printScreen('quiet mode enabled', terminal);

    terminal.write('\x1b');
    await runtime.sleep(300);
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Quiet mode\s+On/i, terminal);
    await runtime.waitForScreenText(/Quiet mode tool preview lines\s+2 lines/i, terminal);
    runtime.printScreen('quiet settings reopened', terminal);

    terminal.write('\x1b[B'.repeat(5));
    await runtime.sleep(300);
    terminal.write('\r');
    await runtime.waitForScreenText(/Show up to 4 preview lines/i, terminal);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Quiet mode tool preview lines\s+4 lines/i, terminal);
    runtime.printScreen('quiet preview updated', terminal);

    terminal.write('\x1b');
    await runtime.sleep(300);
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Quiet mode\s+On/i, terminal);
    await runtime.waitForScreenText(/Quiet mode tool preview lines\s+4 lines/i, terminal);
    runtime.printScreen('quiet settings final reopen', terminal);
  },
} satisfies McE2eScenario;
