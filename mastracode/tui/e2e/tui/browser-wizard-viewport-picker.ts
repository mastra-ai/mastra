import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

/**
 * Reads the persisted viewport back from settings.json on disk.
 * Emits `<label>=1440x900`, `<label>=window`, or `<label>=missing`.
 */
const readViewport = (label: string) =>
  `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const v=(s.browser||{}).viewport; console.log("${label}="+(typeof v==="string"?v:(v?v.width+"x"+v.height:"missing")));'`;

/**
 * Drives the interactive /browser wizard for a fresh agent-browser + bundled +
 * no-profile setup, stopping at the "Viewport size:" picker. The caller then
 * navigates the picker and submits.
 *
 * Wizard order (agent-browser, bundled launch):
 *   Enable? -> Provider -> Headless? -> Launch method -> Use a profile? -> Viewport
 */
async function openWizardToViewport(terminal: any, runtime: any) {
  terminal.submit('/browser');

  await runtime.waitForScreenText(/Enable browser automation\?/i, terminal, 8_000);
  terminal.write('\r');

  await runtime.waitForScreenText(/Select browser provider:/i, terminal, 8_000);
  terminal.write('\x1b[B'); // AgentBrowser (second option)
  terminal.write('\r');

  await runtime.waitForScreenText(/Run in headless mode\?/i, terminal, 8_000);
  terminal.write('\r'); // No (default)

  await runtime.waitForScreenText(/How do you want to launch the browser\?/i, terminal, 8_000);
  terminal.write('\r'); // Bundled browser (default)

  await runtime.waitForScreenText(/Use a browser profile\?/i, terminal, 8_000);
  terminal.write('\r'); // No (default)

  await runtime.waitForScreenText(/Viewport size:/i, terminal, 8_000);
}

export const browserWizardViewportPickerScenario = {
  name: 'browser-wizard-viewport-picker',
  description:
    'Drives the interactive /browser wizard viewport picker: preset, custom size, invalid custom input, and match-window.',
  testName: 'selects viewport presets, custom sizes, and match-window through the /browser wizard picker',
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
    // Start with no browser config so /browser opens the wizard fresh.
    delete settings.browser;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // 1) Select a named preset: Desktop Large (1440x900), one down from Desktop.
    await openWizardToViewport(terminal, runtime);
    terminal.write('\x1b[B'); // Desktop Large
    terminal.write('\r');
    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+1440x900/i, terminal, 8_000);
    terminal.submit(readViewport('PICKER_PRESET'));
    await runtime.waitForScreenText(/PICKER_PRESET=1440x900/i, terminal, 8_000);

    // 2) Custom size: Custom is the last option (5 downs from Desktop Large's
    //    starting index — the picker always starts at Desktop). Type 1600x900.
    await openWizardToViewport(terminal, runtime);
    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B'); // Custom (index 6)
    terminal.write('\r');
    await runtime.waitForScreenText(/Enter viewport as/i, terminal, 8_000);
    terminal.write('1600x900');
    terminal.write('\r');
    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+1600x900/i, terminal, 8_000);
    terminal.submit(readViewport('PICKER_CUSTOM'));
    await runtime.waitForScreenText(/PICKER_CUSTOM=1600x900/i, terminal, 8_000);

    // 3) Invalid custom input: the wizard warns and keeps the previous viewport
    //    (1600x900 from step 2).
    await openWizardToViewport(terminal, runtime);
    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B'); // Custom
    terminal.write('\r');
    await runtime.waitForScreenText(/Enter viewport as/i, terminal, 8_000);
    terminal.write('not-a-size');
    terminal.write('\r');
    await runtime.waitForScreenText(/Invalid viewport size\. Keeping the previous viewport\./i, terminal, 8_000);
    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+1600x900/i, terminal, 8_000);
    terminal.submit(readViewport('PICKER_INVALID'));
    await runtime.waitForScreenText(/PICKER_INVALID=1600x900/i, terminal, 8_000);

    // 4) Match window: 5 downs from Desktop reaches "Match window" (index 5).
    //    Persisted as the 'window' sentinel; status renders "match window".
    await openWizardToViewport(terminal, runtime);
    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B'); // Match window (index 5)
    terminal.write('\r');
    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Viewport:\s+match window/i, terminal, 8_000);
    terminal.submit(readViewport('PICKER_WINDOW'));
    await runtime.waitForScreenText(/PICKER_WINDOW=window/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
