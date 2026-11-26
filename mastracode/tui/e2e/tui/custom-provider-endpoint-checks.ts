import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const secretValue = 'org-secret-e2e-value';
const down = (count: number) => '\x1b[B'.repeat(count);

/** Open the manage menu of the only saved provider and pick the item `steps` rows below "Add model". */
async function openManageItem(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime, steps: number) {
  terminal.submit('/custom-providers');
  await runtime.waitForScreenText(/Mock Endpoint/i, terminal, 8_000);
  terminal.write(`${down(1)}\r`);
  await runtime.waitForScreenText(/Manage provider: Mock Endpoint/i, terminal, 8_000);
  terminal.write(`${down(steps)}\r`);
}

export const customProviderEndpointChecksScenario = {
  name: 'custom-provider-endpoint-checks',
  description: 'tests a custom endpoint, adds a listed model, adds a secret header and chats through the endpoint',
  testName: 'tests a custom endpoint and manages its models and headers through /custom-providers',
  useOpenAIModel: true,
  env: () => ({ MASTRACODE_MODEL_ID: 'mock-endpoint/gpt-4o' }),
  // AIMock lists the fixture models on GET /v1/models: acme-large and gpt-4o.
  aimockFixture: 'custom-provider-endpoint-checks.json',
  prepare({ appDataDir, aimockUrl }) {
    if (!aimockUrl) throw new Error('custom-provider-endpoint-checks needs the AIMock URL');
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.customProviders = [
      { name: 'Mock Endpoint', url: `${aimockUrl}/v1`, apiKey: 'sk-endpoint-checks-e2e', models: ['gpt-4o'] },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Manage menu rows: Add model, Remove model, Edit provider, Delete provider,
    // Test connection, Headers, Auth scheme.
    await openManageItem(terminal, runtime, 4);
    await runtime.waitForScreenText(/Mock Endpoint answered in \d+ ms and lists 2 models/i, terminal, 8_000);

    await openManageItem(terminal, runtime, 0);
    await runtime.waitForScreenText(/Add a model to Mock Endpoint/i, terminal, 8_000);
    // Rows: Add all, Done, acme-large.
    terminal.write(`${down(2)}\r`);
    await runtime.waitForScreenText(/Added model: mock-endpoint\/acme-large/i, terminal, 8_000);

    await openManageItem(terminal, runtime, 5);
    await runtime.waitForScreenText(/Headers for Mock Endpoint/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Header name/i, terminal, 8_000);
    terminal.write('X-Org-Secret\r');
    await runtime.waitForScreenText(/Is X-Org-Secret a secret/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Value for X-Org-Secret/i, terminal, 8_000);
    terminal.write(secretValue);
    await runtime.waitForScreenText(new RegExp(`\\*{${secretValue.length}}`), terminal, 8_000);
    await runtime.waitForScreenTextAbsent(new RegExp(secretValue), terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/X-Org-Secret\s+••••/, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Headers for Mock Endpoint/i, terminal, 8_000);

    // The session runs on mock-endpoint/gpt-4o, so a chat message goes to the custom endpoint.
    terminal.submit('Say hello from the mock endpoint.');
    await runtime.waitForScreenText(/Hello from the mock endpoint\./, terminal, 15_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chats = (requests as Array<{ path?: string; headers?: Record<string, string> }>).filter(
      request => request.path === '/v1/chat/completions',
    );
    if (chats[0]?.headers?.['x-org-secret'] !== secretValue) {
      throw new Error('Expected the chat message to carry the secret header');
    }
  },
} satisfies McE2eScenario;
