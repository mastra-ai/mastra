import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const down = (count: number) => '\x1b[B'.repeat(count);

/**
 * Open the manage menu of the only saved provider and pick the item `steps`
 * rows below "Add model".
 */
async function openManageItem(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime, steps: number) {
  terminal.submit('/custom-providers');
  await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
  await runtime.waitForScreenText(/Mock Endpoint/i, terminal, 8_000);
  terminal.write(down(1));
  terminal.write('\r');
  await runtime.waitForScreenText(/Manage provider: Mock Endpoint/i, terminal, 8_000);
  terminal.write(down(steps));
  terminal.write('\r');
}

export const customProviderEndpointChecksScenario = {
  name: 'custom-provider-endpoint-checks',
  description:
    'tests a custom provider connection, adds models the endpoint lists and sends a test message through the real TUI',
  testName: 'tests a custom endpoint, adds its listed models and gets a model reply through /custom-providers',
  useOpenAIModel: true,
  aimockFixture: 'custom-provider-endpoint-checks.json',
  prepare({ appDataDir, aimockUrl }) {
    if (!aimockUrl) throw new Error('custom-provider-endpoint-checks needs the AIMock URL');
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.customProviders = [
      {
        name: 'Mock Endpoint',
        url: `${aimockUrl}/v1`,
        apiKey: 'sk-endpoint-checks-e2e',
        models: ['gpt-4o'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Manage menu rows: Add model, Remove model, Edit provider, Delete provider,
    // Test connection, Test model, Add models from endpoint, Headers, Auth scheme.
    await openManageItem(terminal, runtime, 4);
    await runtime.waitForScreenText(/Mock Endpoint answered in \d+ ms and lists 5 models\./i, terminal, 8_000);
    runtime.printScreen('connection tested', terminal);

    await openManageItem(terminal, runtime, 6);
    await runtime.waitForScreenText(/Add models from Mock Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/Add the 4 models below/i, terminal, 8_000);
    // Rows: Add all, Done, then the listed models that are not configured yet, sorted.
    terminal.write(down(2));
    terminal.write('\r');
    // The list comes back over the chat, so the added messages are checked once it closes.
    await runtime.waitForScreenText(/Add the 3 models below/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Added 3 models to Mock Endpoint\./i, terminal, 8_000);
    await runtime.waitForScreenText(/Added model: mock-endpoint\/claude-3-5-sonnet-20241022/i, terminal, 8_000);

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Mock Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/5 models/i, terminal, 8_000);
    runtime.printScreen('models added from endpoint', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Add provider/i, terminal, 8_000);

    await openManageItem(terminal, runtime, 5);
    await runtime.waitForScreenText(/Test a model on Mock Endpoint/i, terminal, 8_000);
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
