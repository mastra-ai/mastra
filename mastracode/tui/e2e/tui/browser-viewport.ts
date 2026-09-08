import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const readViewport = (label: string) =>
  `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const v=s.browser.viewport; console.log("${label}="+(typeof v==="string"?v:(v?v.width+"x"+v.height:"missing")));'`;

/**
 * Covers configuring the browser viewport through the real TUI: explicit
 * dimensions, the preset picker, and the guard that stops `window` from being
 * set where the provider silently cannot honor it.
 */
export const browserViewportScenario = {
  name: 'browser-viewport',
  description: 'Sets the browser viewport through /browser set viewport and the preset picker.',
  testName: 'configures the browser viewport through explicit sizes, presets, and the picker',
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
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser set viewport 1600x1000');
    await runtime.waitForScreenText(/Set viewport = 1600x1000/i, terminal, 8_000);

    terminal.submit(readViewport('EXPLICIT_VIEWPORT'));
    await runtime.waitForScreenText(/EXPLICIT_VIEWPORT=1600x1000/i, terminal, 8_000);

    // A size that cannot be parsed is refused before it reaches the browser.
    terminal.submit('/browser set viewport 1280');
    await runtime.waitForScreenText(/Invalid viewport: 1280/i, terminal, 8_000);

    // Stagehand overwrites an absent viewport with its own default when it
    // launches the browser, so 'window' would quietly do nothing there.
    terminal.submit('/browser set viewport window');
    await runtime.waitForScreenText(/viewport window is not supported/i, terminal, 8_000);

    terminal.submit(readViewport('AFTER_REJECT_VIEWPORT'));
    await runtime.waitForScreenText(/AFTER_REJECT_VIEWPORT=1600x1000/i, terminal, 8_000);

    // Omitting the value opens the preset picker instead of erroring.
    terminal.submit('/browser set viewport');
    await runtime.waitForScreenText(/Viewport size\?/i, terminal, 8_000);
    await runtime.waitForScreenText(/desktop-hd/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Set viewport = 1920x1080/i, terminal, 8_000);

    terminal.submit(readViewport('PICKED_VIEWPORT'));
    await runtime.waitForScreenText(/PICKED_VIEWPORT=1920x1080/i, terminal, 8_000);

    terminal.submit('/browser clear viewport');
    await runtime.waitForScreenText(/Cleared viewport/i, terminal, 8_000);

    terminal.submit(readViewport('CLEARED_VIEWPORT'));
    await runtime.waitForScreenText(/CLEARED_VIEWPORT=1280x720/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
