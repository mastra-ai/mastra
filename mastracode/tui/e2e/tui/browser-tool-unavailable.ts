import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentBrowser } from '@mastra/agent-browser';
import type { InputProcessor, ProcessInputArgs } from '@mastra/core/processors';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

const cdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-tool-unavailable-e2e';

type AgentBrowserEnsureReady = typeof AgentBrowser.prototype.ensureReady;
type AgentBrowserGetInputProcessors = typeof AgentBrowser.prototype.getInputProcessors;
type AgentBrowserGoto = typeof AgentBrowser.prototype.goto;

function hasBrowserContextProcessor(processor: InputProcessor): boolean {
  return 'id' in processor && processor.id === 'browser-context';
}

function getRequestBodies(requests: unknown[]): string {
  return JSON.stringify(
    requests.map(request =>
      typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
    ),
  );
}

export const browserToolUnavailableScenario = {
  name: 'browser-tool-unavailable',
  description: 'Executes a browser tool call in the TUI to catch browser-tool unavailable regressions.',
  testName: 'executes configured browser tools from TUI agent turns',
  useOpenAIModel: true,
  aimockFixture: 'browser-tool-unavailable.json',
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
      enabled: true,
      provider: 'agent-browser',
      headless: true,
      viewport: { width: 1280, height: 720 },
      cdpUrl,
      agentBrowser: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(
      AgentBrowser.prototype,
      'ensureReady',
      async function ensureReady(): Promise<void> {} satisfies AgentBrowserEnsureReady,
    );
    patches.setProperty(AgentBrowser.prototype, 'goto', async function goto(input) {
      return {
        success: true,
        url: input.url,
        title: 'OpenClaw',
        hint: 'Browser TUI navigation succeeded',
      };
    } satisfies AgentBrowserGoto);
    patches.setProperty(AgentBrowser.prototype, 'getInputProcessors', function getInputProcessors(
      configuredProcessors: InputProcessor[] = [],
    ) {
      if (configuredProcessors.some(hasBrowserContextProcessor)) return [];
      return [
        {
          id: 'browser-context',
          processInput(args: ProcessInputArgs) {
            const ctx = args.requestContext?.get('browser') as { provider?: string } | undefined;
            if (!ctx) return args.messageList;
            return {
              messages: args.messages,
              systemMessages: [
                ...args.systemMessages,
                {
                  role: 'system',
                  content: `You have access to browser tools (${ctx.provider}). Browser tool unavailable E2E active.`,
                },
              ],
            };
          },
        } satisfies InputProcessor,
      ];
    } satisfies AgentBrowserGetInputProcessors);

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

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider: AgentBrowser \(deterministic\)/i, terminal, 8_000);

    terminal.submit('Open https://openclaw.ai in the browser.');
    await runtime.waitForScreenText(/browser_goto/i, terminal, 10_000);
    await runtime.waitForScreenText(/Browser TUI navigation complete\./i, terminal, 15_000);
    await runtime.waitForScreenTextAbsent(/NoSuchToolError|ToolNotFoundError|No such tool/i, terminal, 1_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(
        `Expected browser tool unavailable scenario to make 2 AIMock requests, received ${requests.length}`,
      );
    }
    const serialized = getRequestBodies(requests);
    expect(serialized).toContain('Open https://openclaw.ai in the browser.');
    expect(serialized).toContain('browser_goto');
    expect(serialized).toContain('call_tui_browser_goto');
    expect(serialized).toContain('Browser TUI navigation succeeded');
    if (/NoSuchToolError|ToolNotFoundError|No such tool/i.test(serialized)) {
      throw new Error('Browser tool call failed as unavailable in the TUI scenario');
    }
  },
} satisfies McE2eScenario;
