import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const down = (count: number) => '\x1b[B'.repeat(count);
const up = (count: number) => '\x1b[A'.repeat(count);

/**
 * Open the manage menu of a saved provider and pick the item `steps` rows
 * below "Add model". `provider.row` counts saved providers from the top of the list.
 */
async function openManageItem(
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
  provider: { name: string; row: number },
  steps: number,
) {
  terminal.submit('/custom-providers');
  await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
  await runtime.waitForScreenText(new RegExp(provider.name, 'i'), terminal, 8_000);
  // Row 0 is "Add provider".
  terminal.write(down(provider.row + 1));
  terminal.write('\r');
  await runtime.waitForScreenText(new RegExp(`Manage provider: ${provider.name}`, 'i'), terminal, 8_000);
  terminal.write(down(steps));
  terminal.write('\r');
}

const mockEndpoint = { name: 'Mock Endpoint', row: 0 };
const missingEndpoint = { name: 'Missing Endpoint', row: 1 };

export const customProviderEndpointChecksScenario = {
  name: 'custom-provider-endpoint-checks',
  description:
    'tests a custom provider connection, adds models the endpoint lists and sends a test message through the real TUI',
  testName: 'tests a custom endpoint, adds its listed models and gets a model reply through /custom-providers',
  useOpenAIModel: true,
  // The fixture's models are what AIMock lists on GET /v1/models: gpt-4o, acme-large, acme-medium, acme-small.
  aimockFixture: 'custom-provider-endpoint-checks.json',
  prepare({ appDataDir, aimockUrl }) {
    if (!aimockUrl) throw new Error('custom-provider-endpoint-checks needs the AIMock URL');
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.customProviders = [
      {
        name: mockEndpoint.name,
        url: `${aimockUrl}/v1`,
        apiKey: 'sk-endpoint-checks-e2e',
        models: ['gpt-4o'],
      },
      {
        name: missingEndpoint.name,
        url: `${aimockUrl}/missing`,
        apiKey: 'sk-endpoint-checks-e2e',
        models: [],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Manage menu rows: Add model, Remove model, Edit provider, Delete provider,
    // Test connection, Test model, Add models from endpoint, Headers, Auth scheme.
    await openManageItem(terminal, runtime, mockEndpoint, 4);
    await runtime.waitForScreenText(/Mock Endpoint answered in \d+ ms and lists 4 models\./i, terminal, 8_000);

    await openManageItem(terminal, runtime, missingEndpoint, 4);
    await runtime.waitForScreenText(/HTTP 404 Not Found from http:\/\/[^/\s]+\/missing\/models/i, terminal, 8_000);
    // "Not found" is the error message in AIMock's 404 body.
    await runtime.waitForScreenText(/^\s*Not found\s*$/im, terminal, 8_000);
    runtime.printScreen('connections tested', terminal);

    await openManageItem(terminal, runtime, mockEndpoint, 6);
    await runtime.waitForScreenText(/Add models from Mock Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/Add the 3 models below/i, terminal, 8_000);
    // Rows: Add all, Done, then acme-large, acme-medium, acme-small.
    terminal.write(down(2));
    terminal.write('\r');
    // The cursor stays on the model after the one just added, so Enter picks acme-medium.
    await runtime.waitForScreenText(/Add the 2 models below/i, terminal, 8_000);
    terminal.write('\r');
    // Rows: Add all, Done, acme-small (cursor).
    await runtime.waitForScreenText(/Add the 1 model below/i, terminal, 8_000);
    terminal.write(up(2));
    terminal.write('\r');
    // The list comes back over the chat, so the added messages are checked once it closes.
    await runtime.waitForScreenText(/Added 1 model to Mock Endpoint\./i, terminal, 8_000);
    await runtime.waitForScreenText(/Added model: mock-endpoint\/acme-large/i, terminal, 8_000);
    await runtime.waitForScreenText(/Added model: mock-endpoint\/acme-medium/i, terminal, 8_000);

    await openManageItem(terminal, runtime, mockEndpoint, 6);
    await runtime.waitForScreenText(/All models Mock Endpoint lists are already added\./i, terminal, 8_000);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Mock Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/4 models/i, terminal, 8_000);
    runtime.printScreen('models added from endpoint', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Add provider/i, terminal, 8_000);

    await openManageItem(terminal, runtime, mockEndpoint, 5);
    await runtime.waitForScreenText(/Test a model on Mock Endpoint/i, terminal, 8_000);
    // Rows: gpt-4o, acme-large, acme-medium, acme-small.
    terminal.write('\r');
    await runtime.waitForScreenText(/gpt-4o replied in \d+ ms: yes/i, terminal, 15_000);
    runtime.printScreen('model tested', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chats = (requests as Array<{ path?: string; headers?: Record<string, string>; body?: any }>).filter(
      request => request.path === '/v1/chat/completions',
    );
    if (chats.length !== 1) throw new Error(`Expected one test message, got ${chats.length}`);
    const [chat] = chats;
    if (chat?.body?.model !== 'gpt-4o')
      throw new Error(`Expected the test message to gpt-4o, got ${chat?.body?.model}`);
    // AIMock journals auth headers as "[REDACTED]", so only their presence can be checked here.
    if (chat.headers?.authorization === undefined) {
      throw new Error('Expected the test message to carry the saved API key in Authorization');
    }
  },
} satisfies McE2eScenario;
