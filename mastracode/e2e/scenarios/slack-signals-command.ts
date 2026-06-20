import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const WORKSPACE = {
  team: 'E2E Slack Workspace',
  team_id: 'T_E2E_001',
  user_id: 'U_E2E_001',
  url: 'https://e2e.slack.com',
};

const CHANNEL = {
  id: 'C_E2E_001',
  name: 'general',
  is_channel: true,
  is_member: true,
  is_archived: false,
};

const MESSAGE = {
  ts: '1700000000.000100',
  user: 'U_E2E_002',
  text: 'Hello from Slack signals e2e!',
};

/**
 * Start a minimal mock Slack Web API server that responds to the subset of
 * endpoints the SlackWebApiSyncClient uses: auth.test, conversations.list,
 * and conversations.history.
 */
async function startMockSlackApiServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      // Slack Web API method name is the last path segment.
      const method = req.url?.replace(/^.*\//, '') ?? '';

      const respond = (payload: Record<string, unknown>) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (method === 'auth.test') {
        respond({ ok: true, ...WORKSPACE });
        return;
      }

      if (method === 'conversations.list') {
        respond({ ok: true, channels: [CHANNEL], response_metadata: {} });
        return;
      }

      if (method === 'conversations.history') {
        respond({ ok: true, messages: [MESSAGE], has_more: false, response_metadata: {} });
        return;
      }

      // Default: ok with empty data for any other endpoint.
      respond({ ok: true });
    });
  });

  const url = await new Promise<string>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('mock Slack API server did not bind'));
        return;
      }
      resolve(`http://127.0.0.1:${(address as AddressInfo).port}`);
    });
  });

  return {
    url,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => resolve());
      }),
  };
}

export const slackSignalsCommandScenario = {
  name: 'slack-signals-command',
  description:
    'subscribes, configures, and unsubscribes a thread to Slack through the real TUI using a mock Slack Web API server',
  testName: 'subscribes, shows config, and unsubscribes via /slack commands in the real TUI',
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
    const mockServer = await startMockSlackApiServer();

    patches.setEnv('SLACK_USER_TOKEN', 'xoxp-e2e-mock-token');
    patches.setEnv('MASTRACODE_SLACK_API_BASE_URL', mockServer.url);

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
            await mockServer.close();
          }
        },
      };
    } catch (error) {
      await mockServer.close();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal, 10_000);

    // Create a thread so Slack subscribe has a thread to attach to.
    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);
    terminal.submit('Create a Slack Signals e2e thread.');
    await runtime.waitForScreenText(/Slack Signals thread ready/i, terminal, 30_000);
    runtime.printScreen('slack thread ready', terminal);

    // /slack config before subscribing should say "not subscribed".
    terminal.submit('/slack config');
    await runtime.waitForScreenText(/not subscribed/i, terminal, 10_000);
    runtime.printScreen('slack config before subscribe', terminal);

    // /slack channels should list available channels from the mock Slack API.
    terminal.submit('/slack channels');
    await runtime.waitForScreenText(/Available channels/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack channels', terminal);

    // /slack subscribe #general should call auth.test + conversations.list and track only that channel.
    terminal.submit('/slack subscribe #general');
    await runtime.waitForScreenText(/Added 1 channel\(s\): #general/i, terminal, 30_000);
    runtime.printScreen('slack subscribe channel', terminal);

    // /slack config after subscribing should show workspace + channel-specific info.
    terminal.submit('/slack config');
    await runtime.waitForScreenText(/E2E Slack Workspace/i, terminal, 10_000);
    await runtime.waitForScreenText(/Channels tracked: 1/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack config after channel subscribe', terminal);

    // /slack debug should show the per-channel polling state.
    terminal.submit('/slack debug');
    await runtime.waitForScreenText(/Poll interval:/i, terminal, 10_000);
    await runtime.waitForScreenText(/#general/i, terminal, 10_000);
    runtime.printScreen('slack debug', terminal);

    // /slack unsubscribe #general should remove just that channel.
    terminal.submit('/slack unsubscribe #general');
    await runtime.waitForScreenText(/Removed 1 channel\(s\): #general/i, terminal, 30_000);
    runtime.printScreen('slack unsubscribe channel', terminal);

    // Removing the last tracked channel removes the Slack subscription.
    terminal.submit('/slack config');
    await runtime.waitForScreenText(/not subscribed/i, terminal, 10_000);
    runtime.printScreen('slack config after channel unsubscribe', terminal);
  },
} satisfies McE2eScenario;