import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const browserWizardBrowserbaseScenario = {
  name: 'browser-wizard-browserbase',
  description: 'Configures Stagehand Browserbase through the interactive /browser wizard.',
  testName: 'saves Browserbase wizard settings without local launch prompts',
  env: () => ({
    BROWSERBASE_API_KEY: 'mc-e2e-browserbase-key',
    BROWSERBASE_PROJECT_ID: 'mc-e2e-browserbase-project',
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
      enabled: false,
      provider: 'stagehand',
      headless: true,
      viewport: { width: 1280, height: 720 },
      cdpUrl: 'ws://127.0.0.1:65535/devtools/browser/stale-browserbase-e2e',
      profile: join(appDataDir, 'stale-browser-profile'),
      executablePath: '/Applications/Stale Chrome.app/Contents/MacOS/Chrome',
      stagehand: { env: 'LOCAL', preserveUserDataDir: true },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser');
    await runtime.waitForScreenText(/Enable browser automation\?/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select browser provider:/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Stagehand environment:/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(
      /Browserbase requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Environment:\s+BROWSERBASE/i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider:\s+Stagehand \(AI-powered\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Environment:\s+BROWSERBASE/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; const sh=b.stagehand||{}; console.log("BROWSERBASE_PROVIDER="+b.provider); console.log("BROWSERBASE_ENABLED="+b.enabled+":"+b.headless); console.log("BROWSERBASE_ENV="+sh.env); console.log("BROWSERBASE_LOCAL_OPTS="+(b.cdpUrl||"missing")+":"+(b.profile||"missing")+":"+(b.executablePath||"missing")+":"+(sh.preserveUserDataDir ?? "missing")); console.log("BROWSERBASE_CREDS_PERSISTED="+Boolean(sh.apiKey||sh.projectId));'`,
    );
    await runtime.waitForScreenText(/BROWSERBASE_PROVIDER=stagehand/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_ENABLED=true:false/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_ENV=BROWSERBASE/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_LOCAL_OPTS=missing:missing:missing:missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSERBASE_CREDS_PERSISTED=false/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
