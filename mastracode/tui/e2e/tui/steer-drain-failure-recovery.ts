import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const START_PROMPT = 'Start a slow steer recovery run.';
const STEER_TEXT = 'Steer while active.';
const RUN_ERROR_MESSAGE = 'Terminal steer recovery API error from the e2e provider.';

// Coordinates the in-process fetch patch with the terminal script: the first run's
// stream stays open until the steer message has been submitted, then errors out. That
// guarantees the steer signal is still queued when the run fails, which routes its
// delivery through the post-completion drain instead of the in-loop signal drain.
let resolveSteerSubmitted: () => void;
let steerSubmitted: Promise<void>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function failingStreamResponse(): Response {
  const encoder = new TextEncoder();
  const partialChunk = {
    type: 'response.output_text.delta',
    content_index: 0,
    delta: 'Initial recovery run streaming.',
    item_id: 'msg-steer-recovery-error',
    logprobs: [],
    output_index: 0,
    sequence_number: 1,
  };
  const errorChunk = {
    type: 'error',
    code: 'invalid_api_key',
    message: RUN_ERROR_MESSAGE,
    param: null,
    sequence_number: 2,
  };
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify(partialChunk)}\n\n`),
      );
      await steerSubmitted;
      controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorChunk)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export const steerDrainFailureRecoveryScenario = {
  name: 'steer-drain-failure-recovery',
  projectFixture: 'long-branch',
  description:
    'Fail the run a steer message was queued behind, make the follow-up run for the queued steer fail to start once, verify the failure renders as an error, and verify the steer survives and delivers on the next turn.',
  testName: 'recovers a queued steer message after the drain follow-up run fails to start',
  useOpenAIModel: true,
  aimockFixture: 'steer-drain-failure-recovery.json',
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    steerSubmitted = new Promise<void>(resolve => {
      resolveSteerSubmitted = resolve;
    });
    const patches = createGlobalPatchScope();

    // Fail the FIRST model call with a non-retryable stream error (after the steer is
    // queued) so the run dies without reaching the in-loop signal drain. Later calls
    // pass through to AIMock.
    const originalFetch = globalThis.fetch.bind(globalThis);
    let failedFirstRun = false;
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const url = requestUrl(input);
      if (!failedFirstRun && (url.includes('/chat/completions') || url.includes('/responses'))) {
        failedFirstRun = true;
        return failingStreamResponse();
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
        // The drain failure under test is agent.stream() rejecting when the runtime starts
        // the follow-up run for the queued signal. AIMock fixtures cannot produce that
        // shape (model level failures surface after the run has registered), and patching
        // the workspace Agent class misses because the app carries its own bundled copy.
        // Wrap stream() on the live agent's real prototype so the drain's follow-up call
        // rejects exactly once.
        onCreated(result) {
          const agent = (result.controller as unknown as { config: { agent: object } }).config.agent;
          const proto = Object.getPrototypeOf(agent) as { stream: (...a: unknown[]) => unknown };
          const originalStream = proto.stream;
          let failedSteerStream = false;
          patches.setProperty(proto, 'stream', function patchedStream(this: unknown, ...args: unknown[]) {
            if (!failedSteerStream && JSON.stringify(args[0])?.includes(STEER_TEXT)) {
              failedSteerStream = true;
              return Promise.reject(Object.assign(new Error('connection error: ECONNRESET'), { code: 'ECONNRESET' }));
            }
            return originalStream.apply(this, args);
          });
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
    runtime.printScreen('spawned', terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.write(START_PROMPT);
    await runtime.waitForScreenText(/Start a slow steer recovery run\./i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Created thread:/i, terminal, 15_000);

    terminal.submit(STEER_TEXT);
    await runtime.waitForScreenText(/Steer while active\./i, terminal);
    runtime.printScreen('after steer submit', terminal);
    resolveSteerSubmitted();

    await runtime.waitForScreenText(/failed to start follow-up run for queued message/i, terminal, 30_000);
    runtime.printScreen('after drain failure error', terminal);

    terminal.submit('Send the next turn.');
    await runtime.waitForScreenText(/Steer recovery follow-up completed\./i, terminal, 60_000);
    runtime.printScreen('after steer redelivery', terminal);

    // Read the full scrollback, not just the viewport, so earlier transcript
    // lines that scrolled offscreen still count toward the assertions.
    const completedView = terminal.serializeHistory?.().output ?? terminal.serialize().view;
    expect(completedView).toContain(STEER_TEXT);
    expect(completedView).toContain('failed to start follow-up run for queued message');
    const steerOccurrences = completedView.split(STEER_TEXT).length - 1;
    if (steerOccurrences !== 1) {
      throw new Error(`expected the steer message to render exactly once, got ${steerOccurrences}`);
    }

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serializedBodies = requests.map(request => JSON.stringify((request as { body?: unknown }).body));
    const steerDeliveries = serializedBodies.filter(body =>
      body.includes('<user delivery=\\"while-active\\">Steer while active.</user>'),
    );
    expect(steerDeliveries).toHaveLength(1);
  },
} satisfies McE2eScenario;
