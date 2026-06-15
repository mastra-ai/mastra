import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const cdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-startup-restore-e2e';

export const browserStartupRestoreScenario = {
  name: 'browser-startup-restore',
  description: 'Restores enabled browser settings at startup and exposes the active browser context to model turns.',
  testName: 'restores browser settings on startup without /browser on',
  useOpenAIModel: true,
  aimockFixture: 'browser-startup-restore.json',
  prepare({ appDataDir, mastracodeDir, projectDir }) {
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
      viewport: { width: 1440, height: 900 },
      cdpUrl,
      agentBrowser: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-browser-startup-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { AgentBrowser } = await import('@mastra/agent-browser');

AgentBrowser.prototype.getInputProcessors = function getInputProcessors(configuredProcessors = []) {
  const hasProcessor = configuredProcessors.some(processor => processor && 'id' in processor && processor.id === 'browser-context');
  if (hasProcessor) return [];
  return [{
    id: 'browser-context',
    processInput(args) {
      const ctx = args.requestContext?.get('browser');
      if (!ctx) return args.messageList;
      return {
        messages: args.messages,
        systemMessages: [
          ...args.systemMessages,
          { role: 'system', content: 'Browser startup restore E2E active with provider ' + ctx.provider + '.' },
        ],
      };
    },
  }];
};

await import(pathToFileURL(join(mastracodeDir, 'src/main.ts')).href);
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-browser-startup-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider: AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Headless: no/i, terminal, 8_000);
    await runtime.waitForScreenText(/CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-startup-restore-e2e/i, terminal, 8_000);

    terminal.submit('Confirm browser startup restore context.');
    await runtime.waitForScreenText(/Browser startup restore confirmed\./i, terminal, 10_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_STARTUP_ENABLED="+b.enabled); console.log("BROWSER_STARTUP_PROVIDER="+b.provider); console.log("BROWSER_STARTUP_CDP="+(b.cdpUrl||"missing"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_STARTUP_ENABLED=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_STARTUP_PROVIDER=agent-browser/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_STARTUP_CDP=ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-startup-restore-e2e/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Confirm browser startup restore context.');
    expect(serialized).toContain('Browser startup restore E2E active');
    expect(serialized).toContain('browser_goto');
    expect(serialized).toContain('browser_snapshot');
  },
} satisfies McE2eScenario;
