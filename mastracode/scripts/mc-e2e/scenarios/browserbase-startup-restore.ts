import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const pendingCdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browserbase-startup-pending';

export const browserbaseStartupRestoreScenario = {
  name: 'browserbase-startup-restore',
  description: 'Restores enabled Stagehand Browserbase settings at startup and tracks them as the active browser runtime.',
  testName: 'restores Browserbase startup settings and separates pending saved drift',
  env: () => ({
    BROWSERBASE_API_KEY: 'mc-e2e-browserbase-startup-key',
    BROWSERBASE_PROJECT_ID: 'mc-e2e-browserbase-startup-project',
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
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'BROWSERBASE' },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Environment:\s+BROWSERBASE/i, terminal, 8_000);

    terminal.submit(`/browser set cdpUrl ${pendingCdpUrl}`);
    await runtime.waitForScreenText(/Set cdpUrl = ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browserbase-startup-pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/Run \/browser on to apply\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser \(active\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Environment:\s+BROWSERBASE/i, terminal, 8_000);
    await runtime.waitForScreenText(/Pending changes \(not yet applied\):/i, terminal, 8_000);
    await runtime.waitForScreenText(/browserbase-startup-pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/browser on to apply, \/browser to reconfigure, or restart\./i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; const sh=b.stagehand||{}; console.log("BROWSERBASE_STARTUP_PROVIDER="+b.enabled+":"+b.provider+":"+sh.env+":"+b.headless); console.log("BROWSERBASE_STARTUP_CDP="+(b.cdpUrl||"missing")); console.log("BROWSERBASE_STARTUP_CREDS="+Boolean(sh.apiKey||sh.projectId));'`,
    );
    await runtime.waitForScreenText(/BROWSERBASE_STARTUP_PROVIDER=true:stagehand:BROWSERBASE:false/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_STARTUP_CDP=ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browserbase-startup-pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_STARTUP_CREDS=false/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
