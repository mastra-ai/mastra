import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const OBJECTIVE = 'Preserve terminal API errors without autonomous continuation.';
const ERROR_MESSAGE = 'Terminal goal API error from the e2e provider.';
const SCORER_PREFIX = `Goal: ${OBJECTIVE}`;

type RequestCounters = {
  successfulPrimaryCalls: number;
  scorerCallsBeforeFailure: number;
  failedPrimaryAttempts: number;
  scorerCallsAfterFailure: number;
  autonomousPrimaryFollowups: number;
  classificationErrors: string[];
};

let counters: RequestCounters;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return '';
}

function classifyRequest(rawBody: string): 'primary' | 'scorer' {
  try {
    JSON.parse(rawBody);
  } catch {
    throw new Error(`Could not parse model request body: ${rawBody.slice(0, 500)}`);
  }

  const hasObjective = rawBody.includes(OBJECTIVE);
  const isScorer = rawBody.includes(SCORER_PREFIX);
  const isPrimary = hasObjective && !isScorer;

  if (isPrimary === isScorer) {
    throw new Error(
      `Expected exactly one request class (primary=${isPrimary}, scorer=${isScorer}): ${rawBody.slice(0, 1000)}`,
    );
  }
  return isScorer ? 'scorer' : 'primary';
}

function terminalErrorResponse(url: string): Response {
  if (url.includes('/responses')) {
    const partialChunk = {
      type: 'response.output_text.delta',
      content_index: 0,
      delta: 'Partial goal work before failure.',
      item_id: 'msg-goal-api-error',
      logprobs: [],
      output_index: 0,
      sequence_number: 1,
    };
    const errorChunk = {
      type: 'error',
      code: 'invalid_api_key',
      message: ERROR_MESSAGE,
      param: null,
      sequence_number: 2,
    };
    return new Response(
      `event: response.output_text.delta\ndata: ${JSON.stringify(partialChunk)}\n\nevent: error\ndata: ${JSON.stringify(errorChunk)}\n\n`,
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  }

  const partialChunk = {
    id: 'chatcmpl-goal-api-error',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'gpt-5.4-mini',
    choices: [
      { index: 0, delta: { role: 'assistant', content: 'Partial goal work before failure.' }, finish_reason: null },
    ],
  };
  const errorChunk = {
    type: 'error',
    sequence_number: 2,
    error: { type: 'authentication_error', code: 'invalid_api_key', message: ERROR_MESSAGE },
  };
  return new Response(`data: ${JSON.stringify(partialChunk)}\n\ndata: ${JSON.stringify(errorChunk)}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function writeProofCounters(): void {
  const outputPath = process.env.MC_E2E_GOAL_API_ERROR_PROOF_OUT;
  if (outputPath) writeFileSync(outputPath, JSON.stringify(counters, null, 2));
}

export const goalApiErrorStopsLoopScenario = {
  name: 'goal-api-error-stops-loop',
  description: 'Keep a non-retryable primary-agent stream error terminal while a goal remains active.',
  testName: 'does not judge or autonomously continue a goal after a terminal API error',
  useOpenAIModel: true,
  aimockFixture: 'goal-api-error-stops-loop.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 2,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    counters = {
      successfulPrimaryCalls: 0,
      scorerCallsBeforeFailure: 0,
      failedPrimaryAttempts: 0,
      scorerCallsAfterFailure: 0,
      autonomousPrimaryFollowups: 0,
      classificationErrors: [],
    };
    writeProofCounters();

    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const url = requestUrl(input);
      if (!url.includes('/chat/completions') && !url.includes('/responses')) return originalFetch(input, init);

      const rawBody = requestBodyText(init?.body);
      let requestClass: 'primary' | 'scorer';
      try {
        requestClass = classifyRequest(rawBody);
      } catch (error) {
        counters.classificationErrors.push(error instanceof Error ? error.message : String(error));
        writeProofCounters();
        throw error;
      }

      if (requestClass === 'scorer') {
        if (counters.failedPrimaryAttempts === 0) counters.scorerCallsBeforeFailure += 1;
        else counters.scorerCallsAfterFailure += 1;
        writeProofCounters();
        return originalFetch(input, init);
      }

      if (counters.successfulPrimaryCalls === 0) {
        counters.successfulPrimaryCalls = 1;
        writeProofCounters();
        return originalFetch(input, init);
      }
      if (counters.failedPrimaryAttempts === 0) counters.failedPrimaryAttempts = 1;
      else counters.autonomousPrimaryFollowups += 1;
      writeProofCounters();
      return terminalErrorResponse(url);
    });

    try {
      const app = await startMastraCodeApp({
        config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
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

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(new RegExp(ERROR_MESSAGE), terminal, 15_000);
    await new Promise(resolve => setTimeout(resolve, 3_000));

    writeProofCounters();
    console.info(
      `[goal-api-error-stops-loop] successful=${counters.successfulPrimaryCalls} preFailureScorer=${counters.scorerCallsBeforeFailure} failed=${counters.failedPrimaryAttempts} postFailureScorer=${counters.scorerCallsAfterFailure} followups=${counters.autonomousPrimaryFollowups}`,
    );
    if (counters.classificationErrors.length > 0) {
      throw new Error(`Request classification failed: ${counters.classificationErrors.join('\n')}`);
    }
    if (
      counters.successfulPrimaryCalls !== 1 ||
      counters.scorerCallsBeforeFailure !== 1 ||
      counters.failedPrimaryAttempts !== 1 ||
      counters.scorerCallsAfterFailure !== 0 ||
      counters.autonomousPrimaryFollowups !== 0
    ) {
      throw new Error(`Terminal error escaped its boundary: ${JSON.stringify(counters)}`);
    }

    terminal.submit('/goal status');
    await runtime.waitForScreenText(
      /Goal \(active\): "Preserve terminal API errors without autonomous continuation\." — 1\/2 turns used/i,
      terminal,
      8_000,
    );

    const view = stripAnsi(terminal.serialize().view);
    if (!view.includes(ERROR_MESSAGE)) throw new Error(`Expected visible terminal error state:\n${view}`);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(
        `Expected one successful primary request and one pre-failure scorer request: ${JSON.stringify(requests)}`,
      );
    }
  },
} satisfies McE2eScenario;
