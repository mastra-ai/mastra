import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentBrowser } from '@mastra/agent-browser';
import type { InputProcessor, ProcessInputArgs } from '@mastra/core/processors';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

const cdpUrl = 'ws://127.0.0.1:65535/devtools/browser/browser-toggle-e2e';

type AgentBrowserGetInputProcessors = typeof AgentBrowser.prototype.getInputProcessors;

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

export const browserToggleAttachScenario = {
  name: 'browser-toggle-attach',
  description:
    'Enables browser automation through /browser on and verifies the attached browser context reaches agent turns.',
  testName: 'enables browser automation and attaches browser context to model turns',
  useOpenAIModel: true,
  aimockFixture: 'browser-toggle-attach.json',
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
                  content: `You have access to a browser (${ctx.provider}). Browser toggle attach E2E active.`,
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
    await runtime.waitForScreenText(/Browser: disabled/i, terminal, 8_000);

    terminal.submit('/browser on');
    await runtime.waitForScreenText(/Browser enabled \(AgentBrowser\)\./i, terminal, 8_000);

    terminal.submit('/browser status');
    await runtime.waitForScreenText(/Browser: enabled/i, terminal, 8_000);
    await runtime.waitForScreenText(/Provider: AgentBrowser \(deterministic\)/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /CDP URL: ws:\/\/127\.0\.0\.1:65535\/devtools\/browser\/browser-toggle-e2e/i,
      terminal,
      8_000,
    );

    terminal.submit('Confirm browser attach context.');
    await runtime.waitForScreenText(/Browser attach context confirmed\./i, terminal, 10_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const b=s.browser||{}; console.log("BROWSER_TOGGLE_ENABLED="+b.enabled); console.log("BROWSER_TOGGLE_PROVIDER="+b.provider); console.log("BROWSER_TOGGLE_CDP_OK="+((b.cdpUrl||"").includes("browser-toggle-e2e")));'`,
    );
    await runtime.waitForScreenText(/BROWSER_TOGGLE_ENABLED=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_TOGGLE_PROVIDER=agent-browser/i, terminal, 8_000);
    await runtime.waitForScreenText(/BROWSER_TOGGLE_CDP_OK=true/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = getRequestBodies(requests);
    expect(serialized).toContain('Confirm browser attach context.');
    expect(serialized).toContain('browser_goto');
    expect(serialized).toContain('browser_snapshot');
  },
} satisfies McE2eScenario;
