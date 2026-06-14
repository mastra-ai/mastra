import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const activeCdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-active-status-active';
const pendingCdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-active-status-pending';

export const browserActivePendingStatusScenario = {
  name: 'browser-active-pending-status',
  description: 'Shows active browser settings separately from pending saved settings when configuration drifts.',
  testName: 'renders active and pending browser status after settings change without applying',
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
      cdpUrl: activeCdpUrl,
      agentBrowser: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider: AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-active-status-active/i, terminal, 8_000);

    terminal.submit(`/browser set cdpUrl ${pendingCdpUrl}`);
    await runtime.waitForScreenText(/Set cdpUrl = ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-active-status-pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/Run \/browser on to apply\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser \(active\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/Pending changes \(not yet applied\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/browser-active-status-active/i, terminal, 8_000);
    await runtime.waitForScreenText(/browser-active-status-pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/browser on to apply, \/browser to reconfigure, or restart\./i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_PENDING_SETTINGS="+[b.enabled,b.provider,b.cdpUrl].join(":"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_PENDING_SETTINGS=true:agent-browser:ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-active-status-pending/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
