import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const profilePath = '~/.mastracode/browser-profile-e2e';
const executablePath = '/tmp/mastracode-browser-e2e-chrome';
const cdpUrl = 'ws://127.0.0.1:9222/devtools/browser/e2e';

export const browserSettingsPersistenceScenario = {
  name: 'browser-settings-persistence',
  description: 'Persists browser quick settings and enforces launch-option mutual exclusion.',
  testName: 'updates browser settings through /browser set and clear commands',
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

    terminal.submit(`/browser set cdpUrl ${cdpUrl}`);
    await runtime.waitForScreenText(/Set cdpUrl = ws:\/\/127\.0\.0\.1:9222\/devtools\/browser\/e2e/i, terminal, 8_000);

    terminal.submit(`/browser set profile ${profilePath}`);
    await runtime.waitForScreenText(/Note: Cleared cdpUrl \(incompatible with profile\)\./i, terminal, 8_000);
    await runtime.waitForScreenText(/Set profile =/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_AFTER_PROFILE_CDP="+(b.cdpUrl||"missing")); console.log("BROWSER_AFTER_PROFILE_SET="+(b.profile&&b.profile.endsWith("browser-profile-e2e"))); console.log("BROWSER_AFTER_PROFILE_PRESERVE="+(b.stagehand&&b.stagehand.preserveUserDataDir));'`,
    );
    await runtime.waitForScreenText(/BROWSER_AFTER_PROFILE_CDP=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_AFTER_PROFILE_SET=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_AFTER_PROFILE_PRESERVE=true/i, terminal, 8_000);

    terminal.submit(`/browser set executablePath ${executablePath}`);
    await runtime.waitForScreenText(/Set executablePath = \/tmp\/mastracode-browser-e2e-chrome/i, terminal, 8_000);

    terminal.submit('/browser clear profile');
    await runtime.waitForScreenText(/Cleared profile\. Run \/browser on to apply\./i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_CDP="+(b.cdpUrl||"missing")); console.log("BROWSER_PROFILE="+(b.profile||"missing")); console.log("BROWSER_EXEC="+(b.executablePath||"missing")); console.log("BROWSER_STAGEHAND_ENV="+(b.stagehand&&b.stagehand.env)); console.log("BROWSER_PRESERVE="+(b.stagehand&&Object.prototype.hasOwnProperty.call(b.stagehand,"preserveUserDataDir")));'`,
    );
    await runtime.waitForScreenText(/BROWSER_CDP=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_PROFILE=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_EXEC=\/tmp\/mastracode-browser-e2e-chrome/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_STAGEHAND_ENV=LOCAL/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_PRESERVE=false/i, terminal, 8_000);

    terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 8_000);
    terminal.submit('/browser clear');
    await runtime.waitForScreenText(/Browser settings reset to defaults\./i, terminal, 15_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_CLEAR_ENABLED="+b.enabled); console.log("BROWSER_CLEAR_PROVIDER="+b.provider); console.log("BROWSER_CLEAR_HEADLESS="+b.headless); console.log("BROWSER_CLEAR_VIEWPORT="+(b.viewport&&b.viewport.width)+"x"+(b.viewport&&b.viewport.height)); console.log("BROWSER_CLEAR_CDP="+(b.cdpUrl||"missing")); console.log("BROWSER_CLEAR_PROFILE="+(b.profile||"missing")); console.log("BROWSER_CLEAR_EXEC="+(b.executablePath||"missing")); console.log("BROWSER_CLEAR_AGENT="+(b.agentBrowser?"kept":"missing"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_CLEAR_ENABLED=false/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_PROVIDER=stagehand/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_HEADLESS=false/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_VIEWPORT=1280x720/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_CDP=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_PROFILE=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_EXEC=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_CLEAR_AGENT=missing/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
