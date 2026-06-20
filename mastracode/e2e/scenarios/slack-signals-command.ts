import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { Hono, Store, WebhookDispatcher, authMiddleware, createApiErrorHandler, createErrorHandler, serve } from '@emulators/core';
import { slackPlugin } from '@emulators/slack';

import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const SLACK_TOKEN = 'xoxp-e2e-mock-token';
const GENERAL_CHANNEL_ID = 'C000000001';
const ROOT_MESSAGE_TS = '1700000000.000100';

/**
 * Start the real @emulators/slack Web API plugin so Slack Signals tools run
 * against emulated Slack state instead of a hand-rolled endpoint stub.
 */
async function startEmulatedSlack(): Promise<{
  url: string;
  close: () => Promise<void>;
  post: (method: string, body?: Record<string, string | number | boolean | undefined>) => Promise<any>;
}> {
  const port = 49214;
  const url = `http://127.0.0.1:${port}`;
  const tokenMap = new Map([
    [
      SLACK_TOKEN,
      {
        id: 1,
        login: 'U000000001',
        scopes: ['chat:write', 'channels:read', 'channels:history', 'users:read'],
      },
    ],
  ]);
  const app = new Hono();
  app.onError(createApiErrorHandler());
  app.use('*', createErrorHandler());
  app.use('*', authMiddleware(tokenMap));
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  slackPlugin.register(app, store, webhooks, url, tokenMap);
  slackPlugin.seed?.(store, url);
  const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });

  const post = async (method: string, body: Record<string, string | number | boolean | undefined> = {}) => {
    const response = await fetch(`${url}/api/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SLACK_TOKEN}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(
        Object.entries(body)
          .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)]),
      ),
    });
    return response.json();
  };

  await post('chat.postMessage', {
    channel: GENERAL_CHANNEL_ID,
    text: 'Earlier context: AIMock lets us test tools deterministically.',
  });
  const root = await post('chat.postMessage', {
    channel: GENERAL_CHANNEL_ID,
    text: 'AIMock is legit',
  });
  await post('chat.postMessage', {
    channel: GENERAL_CHANNEL_ID,
    text: 'Thread reply: it makes Slack signal E2E deterministic.',
    thread_ts: root.ts ?? ROOT_MESSAGE_TS,
  });
  await post('chat.postMessage', {
    channel: GENERAL_CHANNEL_ID,
    text: 'Later context: Slack read tools can pull the nearby conversation.',
  });

  return {
    url,
    close: () => new Promise(resolve => server.close(resolve)),
    post,
  };
}

export const slackSignalsCommandScenario = {
  name: 'slack-signals-command',
  description:
    'subscribes, configures, reads Slack context, and unsubscribes through the real TUI using @emulators/slack',
  testName: 'subscribes and uses Slack read tools through the real TUI runtime',
  useOpenAIModel: true,
  aimockFixture: 'slack-signals-command.json',
  prepare({ appDataDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { signals?: Record<string, unknown> };
    settings.signals = {
      ...settings.signals,
      experimentalSlackSignals: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const emulator = await startEmulatedSlack();

    patches.setEnv('SLACK_USER_TOKEN', SLACK_TOKEN);
    patches.setEnv('MASTRACODE_SLACK_API_BASE_URL', `${emulator.url}/api/`);

    try {
      const app = await startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: true,
          unixSocketPubSub: false,
        },
      });

      return {
        stop: async () => {
          try {
            await patches.stopApp(app.stop);
          } finally {
            await emulator.close();
          }
        },
      };
    } catch (error) {
      await emulator.close();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal, 10_000);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);
    terminal.submit('Create a Slack Signals e2e thread.');
    await runtime.waitForScreenText(/Slack Signals thread ready/i, terminal, 30_000);
    runtime.printScreen('slack thread ready', terminal);

    terminal.submit('/slack config');
    await runtime.waitForScreenText(/not subscribed/i, terminal, 10_000);
    runtime.printScreen('slack config before subscribe', terminal);

    terminal.submit('/slack channels');
    await runtime.waitForScreenText(/Available channels/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack channels', terminal);

    terminal.submit('/slack subscribe #general');
    await runtime.waitForScreenText(/Added 1 channel\(s\): #general/i, terminal, 30_000);
    runtime.printScreen('slack subscribe channel', terminal);

    terminal.submit('/slack config');
    await runtime.waitForScreenText(/Emulate/i, terminal, 10_000);
    await runtime.waitForScreenText(/Channels tracked: 1/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack config after channel subscribe', terminal);

    terminal.submit('Use the Slack read tools to summarize the AIMock Slack discussion.');
    await runtime.waitForScreenText(/slack #general · 3 messages/i, terminal, 20_000);
    await runtime.waitForScreenText(/slack thread · #general/i, terminal, 20_000);
    await runtime.waitForScreenText(/AIMock lets us test tools deterministically/i, terminal, 20_000);
    await runtime.waitForScreenText(/Slack signal E2E deterministic/i, terminal, 20_000);
    runtime.printScreen('slack read tools', terminal);

    terminal.submit('/slack debug');
    await runtime.waitForScreenText(/Poll interval:/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack debug', terminal);

    terminal.submit('/slack unsubscribe #general');
    await runtime.waitForScreenText(/Removed 1 channel\(s\): #general/i, terminal, 30_000);
    runtime.printScreen('slack unsubscribe channel', terminal);

    terminal.submit('/slack config');
    await runtime.waitForScreenText(/not subscribed/i, terminal, 10_000);
    runtime.printScreen('slack config after channel unsubscribe', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('slack_read_conversation')) throw new Error('Expected slack_read_conversation tool call in AIMock requests');
    if (!serialized.includes('slack_read_thread')) throw new Error('Expected slack_read_thread tool call in AIMock requests');
    if (!serialized.includes('AIMock lets us test tools deterministically')) {
      throw new Error('Expected conversation context from emulated Slack in AIMock requests');
    }
    if (!serialized.includes('call_slack_read_thread_e2e')) {
      throw new Error('Expected slack_read_thread tool result turn in AIMock requests');
    }
  },
} satisfies McE2eScenario;
