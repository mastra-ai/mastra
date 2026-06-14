import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const browserProfileProviderMismatchScenario = {
  name: 'browser-profile-provider-mismatch',
  description: 'Warns before reusing a browser profile with a different provider and persists only after confirmation.',
  testName: 'handles browser profile provider mismatch confirmation through the /browser wizard',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const profilePath = join(appDataDir, 'browser-profile-provider-mismatch');
    mkdirSync(profilePath, { recursive: true });
    writeFileSync(join(profilePath, '.mastra-provider'), 'stagehand');

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
      profile: profilePath,
      stagehand: { env: 'LOCAL', preserveUserDataDir: true },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    async function chooseAgentBrowserWithSeededProfile() {
      terminal.submit('/browser');
      await runtime.waitForScreenText(/Enable browser automation\?/i, terminal, 8_000);
      terminal.write('\r');

      await runtime.waitForScreenText(/Select browser provider:/i, terminal, 8_000);
      terminal.write('\x1b[B');
      terminal.write('\r');

      await runtime.waitForScreenText(/Run in headless mode\?/i, terminal, 8_000);
      terminal.write('\r');

      await runtime.waitForScreenText(/How do you want to launch the browser\?/i, terminal, 8_000);
      terminal.write('\r');

      await runtime.waitForScreenText(/Use a browser profile\?/i, terminal, 8_000);
      terminal.write('\x1b[B');
      terminal.write('\r');

      await runtime.waitForScreenText(/Profile directory path:/i, terminal, 8_000);
      terminal.write('\r');
    }

    await chooseAgentBrowserWithSeededProfile();
    await runtime.waitForScreenText(/Continue anyway\?/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Browser setup cancelled\./i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const path=require("path"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; const marker=fs.readFileSync(path.join(b.profile,".mastra-provider"),"utf8").trim(); console.log("BROWSER_MISMATCH_CANCEL="+[b.enabled,b.provider,marker].join(":"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_MISMATCH_CANCEL=false:stagehand:stagehand/i, terminal, 8_000);

    await chooseAgentBrowserWithSeededProfile();
    await runtime.waitForScreenText(/Continue anyway\?/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+AgentBrowser \(deterministic\)/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const path=require("path"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; const marker=fs.readFileSync(path.join(b.profile,".mastra-provider"),"utf8").trim(); console.log("BROWSER_MISMATCH_PROCEED="+[b.enabled,b.provider,b.headless,b.profile.endsWith("browser-profile-provider-mismatch"),marker].join(":"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_MISMATCH_PROCEED=true:agent-browser:false:true:agent-browser/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
