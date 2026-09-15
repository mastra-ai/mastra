import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import { installOpenAIFetchCapture } from './openai-fetch-capture.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE_PREFIX = 'Prepare the goal judge OM isolation result, then stop and wait for explicit user approval.';
const OBJECTIVE = `${OBJECTIVE_PREFIX}${' goal judge context retention marker'.repeat(900)}`;
const FOLLOW_UP = 'I approve the goal judge OM isolation result.';
const WAITING_REASON = 'Waiting for explicit user approval before completing the objective.';
const DONE_REASON = 'The user approved the result and the objective is complete.';
const OBSERVATION_RESPONSE = 'Long goal run checkpoint observed.';
const FIRST_RESPONSE = 'Initial goal work is ready for the first judge pass.';
const INITIAL_RESPONSE = 'The goal judge OM isolation result is ready. Waiting for explicit user approval.';
const FOLLOW_UP_RESPONSE = 'Follow-up main response received; the approved goal is complete.';
const PROVIDER_CHANGE_MARKER = 'Model changed openai/gpt-5.5 → openai/gpt-5.4-mini, activating observations';
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'goal-judge-om-model-isolation-requests.jsonl');

let observedMarkerCount: number | undefined;
let reachedWaiting = false;
let reachedFollowUp = false;
let reachedDone = false;
let completedObservationCycle = false;

type AimockRequest = {
  body?: { model?: string; [key: string]: unknown };
  response?: {
    fixture?: {
      match?: { model?: string; userMessage?: string; sequenceIndex?: number; toolCallId?: string };
      response?: unknown;
    };
    source?: string;
  };
};

function matchesFixture(request: AimockRequest, model: string, userMessage: string, content: string): boolean {
  const fixture = request.response?.fixture;
  return (
    fixture?.match?.model === model &&
    typeof fixture.match.userMessage === 'string' &&
    userMessage.includes(fixture.match.userMessage) &&
    JSON.stringify(fixture.response).includes(content)
  );
}

export const goalJudgeOmModelIsolationScenario = {
  name: 'goal-judge-om-model-isolation',
  description: 'Keeps the main OM model state isolated across a distinct-model goal judge waiting checkpoint.',
  testName: 'does not activate OM for the goal judge model after waiting and a user follow-up',
  useOpenAIModel: true,
  aimockFixture: 'goal-judge-om-model-isolation.json',
  env() {
    return { MASTRACODE_DISABLE_MEMORY: '0' };
  },
  prepare({ appDataDir }) {
    observedMarkerCount = undefined;
    reachedWaiting = false;
    reachedFollowUp = false;
    reachedDone = false;
    completedObservationCycle = false;
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    settings.models = {
      ...((typeof settings.models === 'object' && settings.models !== null ? settings.models : {}) as Record<
        string,
        unknown
      >),
      goalJudgeModel: 'openai/gpt-5.5',
      goalMaxTurns: 3,
      observerModelOverride: 'openai/gpt-5.4-mini',
      reflectorModelOverride: 'openai/gpt-5.4-mini',
      omObservationThreshold: 10_000,
      omReflectionThreshold: 100_000,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const restoreFetch = installOpenAIFetchCapture({
      capturePath: RAW_REQUEST_CAPTURE_PATH,
      append: true,
      inputTokens: 2600,
    });
    const app = await startMastraCodeApp();
    return {
      stop: async () => {
        await app.stop?.();
        restoreFetch();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(new RegExp(INITIAL_RESPONSE, 'i'), terminal, 60_000);
    await runtime.waitForScreenText(/Goal\s+.*waiting\s+.*\(2\/3\)/i, terminal, 60_000);
    reachedWaiting = true;

    terminal.submit(FOLLOW_UP);
    await runtime.waitForScreenText(new RegExp(FOLLOW_UP_RESPONSE, 'i'), terminal, 30_000);
    reachedFollowUp = true;
    await runtime.waitForScreenText(/Goal\s+.*done\s+.*\(3\/3\)/i, terminal, 30_000);
    reachedDone = true;

    await terminal.flushInput?.();
    const history = stripAnsi(
      (terminal as unknown as { serializeHistory(): { output: string } }).serializeHistory().output,
    );
    completedObservationCycle = /Buffered observation/i.test(history) && /Activated observations/i.test(history);
    if (!completedObservationCycle) {
      throw new Error('Expected the TUI history to show both buffered and activated observational-memory markers');
    }
    const markerCount = history.split(PROVIDER_CHANGE_MARKER).length - 1;
    observedMarkerCount = markerCount;
    if (markerCount !== 0) {
      throw new Error(`Expected provider-change marker count 0, received ${markerCount}: ${PROVIDER_CHANGE_MARKER}`);
    }

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const typedRequests = requests as AimockRequest[];
    const unmatched = typedRequests.filter(request => !request.response?.fixture);
    if (unmatched.length > 0) {
      throw new Error(
        `Expected every AIMock request to match a fixture; ${unmatched.length} request(s) were unmatched`,
      );
    }

    const observerRequests = typedRequests.filter(request =>
      matchesFixture(request, 'gpt-5.4-mini', '## New Message History to Observe', OBSERVATION_RESPONSE),
    );
    const initialMain = typedRequests.filter(request =>
      matchesFixture(request, 'gpt-5.4-mini', OBJECTIVE, FIRST_RESPONSE),
    );
    const continuingJudge = typedRequests.filter(request =>
      matchesFixture(
        request,
        'gpt-5.5',
        `Goal: ${OBJECTIVE}`,
        'Continue once more before requesting explicit user approval.',
      ),
    );
    const waitingJudge = typedRequests.filter(request =>
      matchesFixture(request, 'gpt-5.5', `Goal: ${OBJECTIVE}`, WAITING_REASON),
    );
    const doneJudge = typedRequests.filter(request =>
      matchesFixture(request, 'gpt-5.5', `Goal: ${OBJECTIVE}`, DONE_REASON),
    );
    const followUpMain = typedRequests.filter(
      request =>
        matchesFixture(request, 'gpt-5.4-mini', OBJECTIVE, FOLLOW_UP_RESPONSE) &&
        JSON.stringify(request.body).includes(FOLLOW_UP),
    );

    if (observerRequests.length < 1) {
      throw new Error('Expected at least one matched observational-memory request');
    }
    if (initialMain.length < 1) {
      throw new Error(
        `Expected a matched initial main-agent chat request: ${JSON.stringify(typedRequests.map(request => request.response?.fixture))}`,
      );
    }
    if (continuingJudge.length !== 1) {
      throw new Error(`Expected exactly one matched continuing judge request, received ${continuingJudge.length}`);
    }
    if (waitingJudge.length !== 1) {
      throw new Error(`Expected exactly one matched waiting judge request, received ${waitingJudge.length}`);
    }
    if (doneJudge.length !== 1) {
      throw new Error(`Expected exactly one matched done judge request, received ${doneJudge.length}`);
    }
    if (followUpMain.length !== 1) {
      throw new Error(`Expected exactly one matched follow-up main-agent response, received ${followUpMain.length}`);
    }

    const modelCounts = typedRequests.reduce<Record<string, number>>((counts, request) => {
      const model = request.body?.model ?? 'unknown';
      counts[model] = (counts[model] ?? 0) + 1;
      return counts;
    }, {});
    if (!modelCounts['gpt-5.4-mini'] || !modelCounts['gpt-5.5']) {
      throw new Error(`Expected requests to both distinct models, received ${JSON.stringify(modelCounts)}`);
    }

    console.info(
      `[goal-judge-om-model-isolation] models=openai/gpt-5.4-mini,openai/gpt-5.5 request-counts=${JSON.stringify(modelCounts)}`,
    );
    console.info(
      `[goal-judge-om-model-isolation] observation=${completedObservationCycle} waiting=${reachedWaiting} follow-up=${reachedFollowUp} done=${reachedDone} provider-change marker count=${observedMarkerCount}`,
    );
    console.info('[goal-judge-om-model-isolation] matched observer, waiting, follow-up, and done responses');
  },
} satisfies McE2eScenario;
