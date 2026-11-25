import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const secretValue = 'org-secret-e2e-value';
/** The provider URL `prepare` saves. `run` needs it to move the provider to another origin. */
let savedUrl = '';
const down = (count: number) => '\x1b[B'.repeat(count);

/**
 * Open the manage menu of the only saved provider and pick the item `steps`
 * rows below "Add model".
 */
async function openManageItem(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime, steps: number) {
  terminal.submit('/custom-providers');
  await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
  await runtime.waitForScreenText(/Header Endpoint/i, terminal, 8_000);
  terminal.write(down(1));
  terminal.write('\r');
  await runtime.waitForScreenText(/Manage provider: Header Endpoint/i, terminal, 8_000);
  terminal.write(down(steps));
  terminal.write('\r');
}

/** From the headers list, add one header through the name, value and secret prompts. */
async function addHeader(
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
  header: { name: string; value: string; secret: boolean },
) {
  terminal.write('\r');
  await runtime.waitForScreenText(/Header name/i, terminal, 8_000);
  terminal.write(`${header.name}\r`);
  await runtime.waitForScreenText(new RegExp(`Value for ${header.name}`, 'i'), terminal, 8_000);
  terminal.write(`${header.value}\r`);
  await runtime.waitForScreenText(new RegExp(`Is ${header.name} a secret\\?`, 'i'), terminal, 8_000);
  // Rows: Secret, Plain.
  if (!header.secret) terminal.write(down(1));
  terminal.write('\r');
  // The list comes back over the chat with the new header in it.
  await runtime.waitForScreenText(
    new RegExp(`${header.name}\\s+${header.secret ? '••••' : header.value}`),
    terminal,
    8_000,
  );
}

export const customProviderHeadersScenario = {
  name: 'custom-provider-headers',
  description:
    'adds secret and plain headers, switches the auth scheme and moves the URL to another origin through the real TUI',
  testName: 'sends custom headers with an x-api-key and drops the secret header when the URL changes origin',
  useOpenAIModel: true,
  aimockFixture: 'custom-provider-endpoint-checks.json',
  prepare({ appDataDir, aimockUrl }) {
    if (!aimockUrl) throw new Error('custom-provider-headers needs the AIMock URL');
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    savedUrl = `${aimockUrl}/v1`;
    settings.customProviders = [
      {
        name: 'Header Endpoint',
        url: savedUrl,
        apiKey: 'sk-headers-e2e',
        models: ['gpt-4o'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    const submitOverDefault = (value: string) => {
      terminal.write('\x1b[3~'.repeat(120));
      terminal.write(`${value}\r`);
    };

    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // Manage menu rows: Add model, Remove model, Edit provider, Delete provider,
    // Test connection, Test model, Add models from endpoint, Headers, Auth scheme.
    await openManageItem(terminal, runtime, 7);
    await runtime.waitForScreenText(/Headers for Header Endpoint/i, terminal, 8_000);
    await addHeader(terminal, runtime, { name: 'X-Org-Secret', value: secretValue, secret: true });
    await addHeader(terminal, runtime, { name: 'X-Region', value: 'eu-west', secret: false });
    await runtime.waitForScreenText(/X-Org-Secret\s+••••/, terminal, 8_000);
    await runtime.waitForScreenText(/X-Region\s+eu-west/, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(new RegExp(secretValue), terminal, 8_000);
    runtime.printScreen('headers listed', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Headers for Header Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/Added header X-Org-Secret to Header Endpoint\./i, terminal, 8_000);
    await runtime.waitForScreenText(/Added header X-Region to Header Endpoint\./i, terminal, 8_000);

    await openManageItem(terminal, runtime, 8);
    await runtime.waitForScreenText(/Auth scheme for Header Endpoint/i, terminal, 8_000);
    // Rows: Bearer token (current), x-api-key header.
    terminal.write(down(1));
    terminal.write('\r');
    await runtime.waitForScreenText(/Header Endpoint now sends its API key as x-api-key: <key>\./i, terminal, 8_000);

    await openManageItem(terminal, runtime, 5);
    await runtime.waitForScreenText(/Test a model on Header Endpoint/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/gpt-4o replied in \d+ ms: yes/i, terminal, 15_000);

    await openManageItem(terminal, runtime, 2);
    await runtime.waitForScreenText(/Provider name/i, terminal, 8_000);
    submitOverDefault('Header Endpoint');
    await runtime.waitForScreenText(/Base URL/i, terminal, 8_000);
    // localhost and 127.0.0.1 are different origins, even on the same port.
    const movedUrl = savedUrl.replace('//127.0.0.1:', '//localhost:');
    if (movedUrl === savedUrl) throw new Error(`Expected AIMock on 127.0.0.1, got ${savedUrl}`);
    submitOverDefault(movedUrl);
    await runtime.waitForScreenText(/API key/i, terminal, 8_000);
    submitOverDefault('sk-headers-e2e');
    await runtime.waitForScreenText(/Updated custom provider: Header Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /Removed secret headers because the URL moved to another origin: X-Org-Secret\. Add them again under "Headers"\./i,
      terminal,
      8_000,
    );

    await openManageItem(terminal, runtime, 7);
    await runtime.waitForScreenText(/Headers for Header Endpoint/i, terminal, 8_000);
    await runtime.waitForScreenText(/X-Region\s+eu-west/, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/X-Org-Secret\s+••••/, terminal, 8_000);
    runtime.printScreen('secret header dropped', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chats = (requests as Array<{ path?: string; headers?: Record<string, string> }>).filter(
      request => request.path === '/v1/chat/completions',
    );
    if (chats.length !== 1) throw new Error(`Expected one test message, got ${chats.length}`);
    const headers = chats[0]?.headers ?? {};
    if (headers['x-org-secret'] !== secretValue) throw new Error('Expected the secret header on the test message');
    if (headers['x-region'] !== 'eu-west') throw new Error('Expected the plain header on the test message');
    // AIMock journals auth headers as "[REDACTED]", so only their presence can be checked here.
    if (headers['x-api-key'] === undefined) throw new Error('Expected the API key in x-api-key');
    if (headers.authorization !== undefined) throw new Error('Expected no Authorization header with x-api-key');
  },
} satisfies McE2eScenario;
