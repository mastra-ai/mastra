import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const REJECTED_PROMPT = 'Trigger a provider safety rejection.';
const FOLLOWUP_PROMPT = 'Continue after the safety rejection.';
const FOLLOWUP_RESPONSE = 'Recovered after the safety rejection.';
const PROVIDER_MESSAGE =
  'Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getRequestBody(request: unknown): unknown {
  return request && typeof request === 'object' && 'body' in request ? request.body : undefined;
}

export const providerSafetyRejectionScenario = {
  name: 'provider-safety-rejection',
  description: 'Show the provider wording and recovery hint when a provider safety system rejects a request.',
  testName: 'shows the provider safety wording and a retry hint, then accepts a follow-up prompt',
  useOpenAIModel: true,
  aimockFixture: 'provider-safety-rejection.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      if (
        requestUrl(input).includes('/responses') &&
        body.includes(REJECTED_PROMPT) &&
        !body.includes(FOLLOWUP_PROMPT)
      ) {
        return new Response(
          JSON.stringify({
            error: { message: PROVIDER_MESSAGE, type: 'invalid_request_error', param: null, code: null },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
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

    terminal.submit(REJECTED_PROMPT);
    // \s+ between words: the error and hint wrap across terminal lines
    await runtime.waitForScreenText(/safety\s+system\s+blocked\s+this\s+request/i, terminal, 30_000);
    await runtime.waitForScreenText(/rejected\s+as\s+a\s+result\s+of\s+our\s+safety\s+system/i, terminal);
    await runtime.waitForScreenText(
      /Hint:\s+Retry,\s+rephrase,\s+or\s+use\s+\/model\s+to\s+switch\s+models/i,
      terminal,
    );

    terminal.submit(FOLLOWUP_PROMPT);
    await runtime.waitForScreenText(new RegExp(FOLLOWUP_RESPONSE), terminal, 30_000);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests.map(getRequestBody));
    if (!body.includes(FOLLOWUP_PROMPT)) {
      throw new Error(`Expected the follow-up prompt to reach AIMock. Requests: ${body}`);
    }
  },
} satisfies McE2eScenario;
