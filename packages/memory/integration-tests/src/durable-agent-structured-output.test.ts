/**
 * Port of harness case T15 (structured output) onto the LLM recorder.
 *
 * The agent is asked for a structured reply while `isTaskComplete` scores it. T15's claims:
 *
 * - no error chunk surfaces, and the client stream carries zero `response-metadata` chunks
 *   (COR-1328 / #25078);
 * - exactly one finish and one `onFinish`, and no `onError`;
 * - no Anthropic request ends on an assistant turn (F5/F7 shape — structured output must not
 *   leave a trailing assistant message for the next request);
 * - the parsed object matches the schema, including `number === 7`;
 * - with a scorer that fails once, the scores are `[0, 1]`.
 *
 * The model's prose (`reply`) is free text and is excluded from the contract, like the harness
 * does. The PrefillErrorHandler only became relevant on this path after #25390 widened
 * `trailing-assistant-guard.ts` to every Claude 4.6+ request, so the Anthropic prefill checks here
 * are the regression guard for that gate.
 *
 * Replay is the default: traffic is served from `packages/memory/__recordings__/`. To re-record
 * (needs OPENAI_API_KEY and ANTHROPIC_API_KEY), from `packages/memory/integration-tests`:
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-structured-output.test.ts
 */
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ENGINES,
  PROVIDERS,
  assistantEndedRequests,
  chunksOfType,
  createCellMemory,
  errorChunks,
  isReplayDeterministic,
  prefillRepairs,
  recordProviderRequests,
  streamTurn,
  useRecordedMock,
} from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-structured-output';
const PROMPT = 'Give a one-sentence reply containing the word ALPHA, and the number 7.';
const SCHEMA = z.object({ reply: z.string(), number: z.number() });

function createScorerThatFailsOnce(scores: number[]) {
  return createScorer({ id: 't15-scorer', description: 'fails the first structured reply' })
    .generateScore(async () => {
      const score = scores.length >= 1 ? 1 : 0;
      scores.push(score);
      return score;
    })
    .generateReason(async ({ score }) => (score ? 'complete' : 'Try again and include the number 7.'));
}

describe.each(Object.entries(PROVIDERS))('T15 structured output — %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    // One recording file per provider × engine, covering the pass/failonce variants.
    const mock = useRecordedMock(`${RECORDING_NAME}-${provider}-${engine}`, { transformRequest });
    let recorder: ReturnType<typeof recordProviderRequests>;

    beforeEach(() => {
      recorder = recordProviderRequests();
    });

    afterEach(() => {
      recorder.restore();
    });

    async function runCell(withFailingScorer: boolean) {
      const variant = withFailingScorer ? 'failonce' : 'pass';
      const scores: number[] = [];
      const cell = await createCellMemory(`t15-${provider}-${engine}-${variant}`);
      const agent = new Agent({
        id: `t15-agent-${provider}-${engine}`,
        name: 't15',
        model,
        memory: cell.memory,
        instructions: 'Answer briefly. Always respect the requested structure.',
        ...(withFailingScorer
          ? { defaultOptions: { isTaskComplete: { scorers: [createScorerThatFailsOnce(scores)] } } }
          : {}),
      });
      const runner =
        engine === 'plain'
          ? agent
          : engine === 'durable'
            ? createDurableAgent({ agent })
            : createEventedAgent({ agent });
      const mastra = new Mastra({ agents: { t15: runner as any }, storage: cell.storage, logger: false });
      if (engine !== 'plain') {
        expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
      }

      const thread = `t15-thread-${provider}-${engine}`;
      const resource = `t15-resource-${provider}-${engine}`;
      const run = await streamTurn(runner, engine, PROMPT, {
        memory: { thread, resource },
        maxSteps: 4,
        structuredOutput: { schema: SCHEMA },
      });
      await mastra.stopWorkers?.();
      await cell.cleanup();
      return { scores, run };
    }

    function expectSettled(chunks: any[], threw: string | null, finishPayloads: any[], errorPayloads: any[]) {
      expect(threw).toBeNull();
      expect(errorChunks(chunks)).toEqual([]);
      // COR-1328 / #25078: response metadata must not leak onto the client stream.
      expect(chunksOfType(chunks, 'response-metadata')).toEqual([]);
      expect(chunksOfType(chunks, 'finish')).toHaveLength(1);
      expect(finishPayloads).toHaveLength(1);
      expect(errorPayloads).toEqual([]);
    }

    it('pass: parses the object and leaves no assistant-ended request', async () => {
      const { run, scores } = await runCell(false);
      const { chunks, threw, finishPayloads, errorPayloads } = run;
      expectSettled(chunks, threw, finishPayloads, errorPayloads);
      expect(scores).toEqual([]);

      // No Anthropic request may end on an assistant turn. OpenAI accepts them; we only pin that
      // the requests were accepted (status 200) rather than rejected.
      const ended = assistantEndedRequests(recorder.requests);
      expect(ended.rejected).toEqual([]);
      const repairs = prefillRepairs(recorder.requests);
      expect(repairs.spurious).toEqual([]);

      const object = finishPayloads[0]?.object;
      expect(SCHEMA.safeParse(object).success).toBe(true);
      expect(object).toMatchObject({ number: 7 });
      expect(typeof object.reply).toBe('string');
    });

    it('failonce: scores 0 then 1 and still settles on one finish', async () => {
      const { run, scores } = await runCell(true);
      const { chunks, threw, finishPayloads, errorPayloads } = run;
      expectSettled(chunks, threw, finishPayloads, errorPayloads);

      expect(scores).toEqual([0, 1]);
      const ended = assistantEndedRequests(recorder.requests);
      expect(ended.rejected).toEqual([]);
      // OpenAI accepts an assistant-ended turn, so the retry control *is* that accepted request.
      // Require it in replay: otherwise a skipped second turn would pass as "nothing rejected".
      if (isReplayDeterministic(mock) && provider === 'openai') {
        expect(ended.accepted.length).toBeGreaterThan(0);
      }
      const object = finishPayloads.at(-1)?.object;
      expect(SCHEMA.safeParse(object).success).toBe(true);
      expect(object).toMatchObject({ number: 7 });
    });
  });
});
