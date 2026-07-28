import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const PROMPT = 'Trigger a retryable stream error once.';
const RESPONSE = 'Recovered after retryable stream error.';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getRequestBody(request: unknown): unknown {
  return request && typeof request === 'object' && 'body' in request ? request.body : undefined;
}

export const streamErrorRetryScenario = {
  name: 'stream-error-retry',
  description: 'Recover from a retryable provider error during a real TUI run.',
  testName: 'retries a retryable provider error and completes the TUI response',
  useOpenAIModel: true,
  aimockFixture: 'stream-error-retry.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    let failedOnce = false;
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      if (!failedOnce && requestUrl(input).includes('/chat/completions')) {
        failedOnce = true;
        throw Object.assign(new Error('Cannot connect to API: write EPIPE'), { code: 'EPIPE' });
      }
      return originalFetch(input, init);
    });

    try {
      const app = await startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: true,
          unixSocketPubSub: false,
        },
      });
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(new RegExp(RESPONSE), terminal, 30_000);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected exactly one successful AIMock request after retry, received ${requests.length}`);
    }
    const body = JSON.stringify(requests.map(getRequestBody));
    if (!body.includes(PROMPT)) {
      throw new Error(`Expected retried request body to include prompt. Requests: ${body}`);
    }
  },
} satisfies McE2eScenario;
