import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const stateSignalBrowserProcessorScenario = {
  name: 'state-signal-browser-processor',
  description: 'Runs a deterministic browser context processor through the TUI and verifies live snapshot/delta state signals.',
  testName: 'renders browser processor state snapshots and deltas during live turns',
  useOpenAIModel: true,
  aimockFixture: 'state-signal-browser-processor.json',
  prepare({ appDataDir, mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    const statePath = join(appDataDir, 'browser-state-processor.json');
    writeFileSync(
      statePath,
      JSON.stringify({
        tabs: [{ url: 'https://example.test/browser-snapshot', title: 'Browser Snapshot E2E' }],
        activeTabIndex: 0,
      }),
    );
    writeFileSync(
      join(projectDir, '.mc-e2e-browser-processor-entrypoint.ts'),
      `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const appDataDir = process.env.MASTRA_APP_DATA_DIR;
if (!appDataDir) throw new Error('MASTRA_APP_DATA_DIR is required');
const statePath = join(appDataDir, 'browser-state-processor.json');
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);
const { BrowserContextProcessor } = await import(pathToFileURL(join(mastracodeDir, '..', 'packages/core/src/browser/index.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

let lastState;
function readState() {
  const parsed = JSON.parse(readFileSync(statePath, 'utf8'));
  lastState = parsed;
  return parsed;
}

const browser = {
  id: 'mc-e2e-browser-processor',
  name: 'MC E2E Browser Processor',
  provider: 'mc-e2e-browser',
  providerType: 'sdk',
  headless: false,
  status: 'ready',
  getInputProcessors(configuredProcessors = []) {
    const hasProcessor = configuredProcessors.some(processor => processor && 'id' in processor && processor.id === 'browser-context');
    return hasProcessor ? [] : [new BrowserContextProcessor()];
  },
  getTools() {
    return {};
  },
  hasThreadSession() {
    return true;
  },
  isBrowserRunning() {
    return true;
  },
  getSessionId(threadId) {
    return 'mc-e2e-browser-session:' + (threadId || 'shared');
  },
  getCdpUrl() {
    return null;
  },
  getLastBrowserState() {
    return lastState;
  },
  async getCurrentUrl() {
    const state = readState();
    return state.tabs?.[state.activeTabIndex || 0]?.url || null;
  },
  async getBrowserState() {
    return readState();
  },
};

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
  browser,
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
    return join(projectDir, '.mc-e2e-browser-processor-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal);

    terminal.submit('Capture browser processor snapshot.');
    await runtime.waitForScreenText(/State snapshot: browser/i, terminal, 10_000);
    await runtime.waitForScreenText(/Active tab URL: https:\/\/example\.test\/browser-snapshot/i, terminal, 10_000);
    await runtime.waitForScreenText(/Browser processor snapshot captured/i, terminal, 10_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); fs.writeFileSync(process.env.MASTRA_APP_DATA_DIR+"/browser-state-processor.json", JSON.stringify({tabs:[{url:"https://example.test/browser-delta",title:"Browser Delta E2E"},{url:"https://example.test/second-tab",title:"Second Tab"}],activeTabIndex:0})); console.log("BROWSER_PROCESSOR_STATE=delta-ready");'`,
    );
    await runtime.waitForScreenText(/BROWSER_PROCESSOR_STATE=delta-ready/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_PROCESSOR_STATE=delta-ready[\s\S]*✓/i, terminal, 8_000);

    terminal.submit('Capture browser processor delta.');
    await runtime.waitForScreenText(/State delta: browser/i, terminal, 10_000);
    await runtime.waitForScreenText(/user changed active tab URL to https:\/\/example\.test\/browser-delta/i, terminal, 10_000);
    await runtime.waitForScreenText(/Browser processor delta captured/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Capture browser processor snapshot.');
    expect(serialized).toContain('Active tab URL: https://example.test/browser-snapshot.');
    expect(serialized).toContain('Capture browser processor delta.');
    expect(serialized).toContain('user changed active tab URL to https://example.test/browser-delta');
  },
} satisfies McE2eScenario;
