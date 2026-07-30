import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MastraBrowser } from '@mastra/core/browser';
import type { BrowserState } from '@mastra/core/browser';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

class BrowserProcessorFixture extends MastraBrowser {
  readonly id = 'mc-e2e-browser-processor';
  readonly name = 'MC E2E Browser Processor';
  readonly provider = 'mc-e2e-browser';
  readonly providerType = 'sdk' as const;
  private readonly statePath: string;
  private lastState: BrowserState | undefined;

  constructor(statePath: string) {
    super({ headless: false });
    this.statePath = statePath;
    this.status = 'ready';
  }

  protected async doLaunch(): Promise<void> {
    this.status = 'ready';
  }

  protected async doClose(): Promise<void> {
    this.status = 'closed';
  }

  protected async getActivePage(): Promise<{ url(): string } | null> {
    const state = this.readState();
    const activeTab = state.tabs[state.activeTabIndex];
    return { url: () => activeTab?.url ?? '' };
  }

  protected getBrowserStateForThread(): BrowserState | null {
    return this.lastState ?? this.readState();
  }

  getLastBrowserState(): BrowserState | undefined {
    return this.lastState;
  }

  async getCurrentUrl(): Promise<string | null> {
    const state = this.readState();
    return state.tabs[state.activeTabIndex]?.url ?? null;
  }

  async getBrowserState(): Promise<BrowserState | null> {
    return this.readState();
  }

  getTools(): Record<string, never> {
    return {};
  }

  private readState(): BrowserState {
    const state = JSON.parse(readFileSync(this.statePath, 'utf8')) as BrowserState;
    this.lastState = state;
    return state;
  }
}

let browserProcessorStatePath: string | undefined;

function getRequestBody(request: unknown): unknown {
  if (request && typeof request === 'object' && 'body' in request) {
    return request.body;
  }
  return undefined;
}

export const stateSignalBrowserProcessorScenario = {
  name: 'state-signal-browser-processor',
  description:
    'Runs a deterministic browser context processor through the TUI and verifies live snapshot/delta state signals.',
  testName: 'renders browser processor state snapshots and deltas during live turns',
  useOpenAIModel: true,
  disableMemory: false,
  aimockFixture: 'state-signal-browser-processor.json',
  prepare({ appDataDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    browserProcessorStatePath = join(appDataDir, 'browser-state-processor.json');
    writeFileSync(
      browserProcessorStatePath,
      JSON.stringify({
        tabs: [{ url: 'https://example.test/browser-snapshot', title: 'Browser Snapshot E2E' }],
        activeTabIndex: 0,
      }),
    );
  },
  inProcessApp({ appDataDir, startMastraCodeApp }) {
    const browser = new BrowserProcessorFixture(join(appDataDir, 'browser-state-processor.json'));
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      onCreated(result) {
        result.controller.setBrowser(browser);
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal);

    terminal.submit('Capture browser processor snapshot.');
    await runtime.waitForScreenText(/State snapshot: browser/i, terminal, 10_000);
    await runtime.waitForScreenText(/Active tab URL: https:\/\/example\.test\/browser-snapshot/i, terminal, 10_000);
    await runtime.waitForScreenText(/Browser processor snapshot captured/i, terminal, 10_000);

    if (!browserProcessorStatePath) throw new Error('Browser processor state path was not initialized');
    writeFileSync(
      browserProcessorStatePath,
      JSON.stringify({
        tabs: [
          { url: 'https://example.test/browser-delta', title: 'Browser Delta E2E' },
          { url: 'https://example.test/second-tab', title: 'Second Tab' },
        ],
        activeTabIndex: 0,
      }),
    );

    terminal.submit('Capture browser processor delta.');
    await runtime.waitForScreenText(/State delta: browser/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /user changed active tab URL to https:\/\/example\.test\/browser-delta/i,
      terminal,
      10_000,
    );
    await runtime.waitForScreenText(/Browser processor delta captured/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map(getRequestBody));
    expect(serialized).toContain('Capture browser processor snapshot.');
    expect(serialized).toContain('Active tab URL: https://example.test/browser-snapshot.');
    expect(serialized).toContain('Capture browser processor delta.');
    expect(serialized).toContain('user changed active tab URL to https://example.test/browser-delta');
  },
} satisfies McE2eScenario;
