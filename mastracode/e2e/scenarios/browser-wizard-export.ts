import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentBrowser } from '@mastra/agent-browser';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

const cdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-wizard-export-e2e';
const exportPath = '/tmp/mastracode-browser-wizard-export-storage-state.json';

type AgentBrowserExportStorageState = typeof AgentBrowser.prototype.exportStorageState;

export const browserWizardExportScenario = {
  name: 'browser-wizard-export',
  description: 'Configures AgentBrowser through the interactive /browser wizard and exports storage state.',
  testName: 'saves browser wizard settings and exports AgentBrowser storage state',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    settings.onboarding = {
      ...((typeof settings.onboarding === 'object' && settings.onboarding !== null
        ? settings.onboarding
        : {}) as Record<string, unknown>),
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
    rmSync(exportPath, { force: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(AgentBrowser.prototype, 'exportStorageState', async function exportStorageState(path: string) {
      writeFileSync(path, JSON.stringify({ source: 'browser-wizard-export-e2e', provider: 'agent-browser' }, null, 2));
    } satisfies AgentBrowserExportStorageState);

    try {
      const app = await startMastraCodeApp();
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser');
    await runtime.waitForScreenText(/Enable browser automation\?/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Select browser provider:/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Run in headless mode\?/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/How do you want to launch the browser\?/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/CDP WebSocket URL/i, terminal, 8_000);
    terminal.write(cdpUrl);
    terminal.write('\r');

    await runtime.waitForScreenText(/Browser automation enabled:/i, terminal, 10_000);
    await runtime.waitForScreenText(/Provider:\s+AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Headless:\s+no/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-wizard-export-e2e/i,
      terminal,
      8_000,
    );

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider:\s+AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-wizard-export-e2e/i,
      terminal,
      8_000,
    );

    terminal.submit(`/browser export storageState ${exportPath}`);
    await runtime.waitForScreenText(
      /Storage state exported to: \/tmp\/mastracode-browser-wizard-export-storage-state\.json/i,
      terminal,
      8_000,
    );

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; const exported=JSON.parse(fs.readFileSync("${exportPath}","utf8")); console.log("BROWSER_WIZARD_PROVIDER="+b.provider); console.log("BROWSER_WIZARD_ENABLED="+b.enabled+":"+b.headless); console.log("BROWSER_WIZARD_CDP="+(b.cdpUrl||"missing").includes("browser-wizard-export-e2e")); console.log("BROWSER_WIZARD_LAUNCH_OPTS="+(b.profile||"missing")+":"+(b.executablePath||"missing")); console.log("BROWSER_WIZARD_EXPORT="+exported.source+":"+exported.provider);'`,
    );
    await runtime.waitForScreenText(/BROWSER_WIZARD_PROVIDER=agent-browser/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_WIZARD_ENABLED=true:false/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_WIZARD_CDP=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_WIZARD_LAUNCH_OPTS=missing:missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_WIZARD_EXPORT=browser-wizard-export-e2e:agent-browser/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
