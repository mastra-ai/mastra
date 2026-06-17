import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const PROMPT = 'Trigger a retryable stream error once.';
const RESPONSE = 'Recovered after retryable stream error.';

export const streamErrorRetryScenario: McE2eScenario = {
  name: 'stream-error-retry',
  description: 'Recover from a retryable provider error during a real TUI run.',
  testName: 'retries a retryable provider error and completes the TUI response',
  useOpenAIModel: true,
  aimockFixture: 'stream-error-retry.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-stream-error-retry-entrypoint.ts'),
      `import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const originalFetch = globalThis.fetch;
let failedOnce = false;

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!failedOnce && url.includes('/chat/completions')) {
    failedOnce = true;
    return new Response(
      'data: {"type":"error","sequence_number":1,"error":{"type":"server_error","code":"internal_error","message":"An internal error occurred."}}\\n\\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  }
  return originalFetch(input, init);
};

const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
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
    return join(projectDir, '.mc-e2e-stream-error-retry-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(new RegExp(RESPONSE), terminal, 30_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected exactly one successful AIMock request after retry, received ${requests.length}`);
    }
    const body = JSON.stringify(requests.map((request: any) => request.body));
    if (!body.includes(PROMPT)) {
      throw new Error(`Expected retried request body to include prompt. Requests: ${body}`);
    }
  },
};
