import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const cdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-toggle-e2e';

export const browserToggleAttachScenario = {
  name: 'browser-toggle-attach',
  description: 'Enables browser automation through /browser on and verifies the attached browser context reaches agent turns.',
  testName: 'enables browser automation and attaches browser context to model turns',
  useOpenAIModel: true,
  aimockFixture: 'browser-toggle-attach.json',
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
      enabled: false,
      provider: 'agent-browser',
      headless: true,
      viewport: { width: 1280, height: 720 },
      cdpUrl,
      agentBrowser: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-browser-toggle-entrypoint.ts'),
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
          { role: 'system', content: 'You have access to a browser (' + ctx.provider + '). Browser toggle attach E2E active.' },
        ],
      };
    },
  }];
};

const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-browser-toggle-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: disabled/i, terminal, 8_000);

    terminal.submit('/browser on');
    await runtime.waitForScreenText(/Browser enabled \(AgentBrowser\)\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider: AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-toggle-e2e/i, terminal, 8_000);

    terminal.submit('Confirm browser attach context.');
    await runtime.waitForScreenText(/Browser attach context confirmed\./i, terminal, 10_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_TOGGLE_ENABLED="+b.enabled); console.log("BROWSER_TOGGLE_PROVIDER="+b.provider); console.log("BROWSER_TOGGLE_CDP="+(b.cdpUrl||"missing"));'`,
    );
    await runtime.waitForScreenText(/BROWSER_TOGGLE_ENABLED=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_TOGGLE_PROVIDER=agent-browser/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_TOGGLE_CDP=ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-toggle-e2e/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Confirm browser attach context.');
    expect(serialized).toContain('browser_goto');
    expect(serialized).toContain('browser_snapshot');
  },
} satisfies McE2eScenario;
