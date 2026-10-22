/**
 * Port of harness case T3 (is-task-complete) provider cells, on the LLM recorder.
 *
 * An `isTaskComplete` scorer runs against the model's reply. A failing check injects feedback and
 * the loop runs again, so the scorer must run once per committed reply, the feedback must be
 * delivered to the model and persisted exactly once, and the run must settle with a single finish.
 *
 * The harness case is model-free today (it scripts the reply); this port keeps the real-provider
 * cells the ticket covers. The `durable-recover` cells belong to the restart-family ticket
 * (COR-1440) and are deliberately not ported here.
 *
 * Replay is the default: traffic is served from `packages/memory/__recordings__/`, so CI runs this
 * without API keys. To re-record (needs OPENAI_API_KEY and ANTHROPIC_API_KEY), from
 * `packages/memory/integration-tests`:
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-is-task-complete.test.ts
 */
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ENGINES,
  PROVIDERS,
  chunksOfType,
  createCellMemory,
  errorChunks,
  messageText,
  persistedMessages,
  prefillRepairs,
  recordProviderRequests,
  streamTurn,
} from './durable-harness-helpers';
import type { ModelRequest } from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-is-task-complete';
const FEEDBACK = 'The reply is missing the required word OMEGA.';
const PROMPT = 'Reply with one short sentence that contains the word ALPHA.';

function createScorerThatFailsOnce(scores: number[]) {
  return createScorer({ id: 't3-scorer', description: 'requires OMEGA after one failure' })
    .generateScore(async () => {
      const score = scores.length >= 1 ? 1 : 0;
      scores.push(score);
      return score;
    })
    .generateReason(async ({ score }) => (score ? 'complete' : FEEDBACK));
}

function createAlwaysPassingScorer(scores: number[]) {
  return createScorer({ id: 't3-scorer', description: 'accepts the first reply' })
    .generateScore(async () => {
      scores.push(1);
      return 1;
    })
    .generateReason(async () => 'complete');
}

describe.each(Object.entries(PROVIDERS))('T3 is-task-complete — %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    let mock: ReturnType<typeof createGatewayMock>;
    let recorder: ReturnType<typeof recordProviderRequests>;

    beforeEach(() => {});

    afterEach(async () => {
      recorder.restore();
      await mock.saveAndStop();
    });

    async function runCell(scorer: (scores: number[]) => ReturnType<typeof createScorer>, variant: string) {
      mock = createGatewayMock({
        name: `${RECORDING_NAME}-${provider}-${engine}-${variant}`,
        exactMatch: true,
        transformRequest,
      });
      mock.start();
      recorder = recordProviderRequests();
      const scores: number[] = [];
      const onComplete: boolean[] = [];
      const cell = await createCellMemory(`t3-${provider}-${engine}-${variant}`);
      const agent = new Agent({
        id: `t3-agent-${provider}-${engine}`,
        name: 't3',
        model,
        memory: cell.memory,
        instructions: 'Answer briefly.',
        defaultOptions: {
          isTaskComplete: {
            scorers: [scorer(scores)],
            onComplete: (r: any) => {
              onComplete.push(r.complete);
            },
          },
        },
      });
      const runner =
        engine === 'plain'
          ? agent
          : engine === 'durable'
            ? createDurableAgent({ agent })
            : createEventedAgent({ agent });
      const mastra = new Mastra({ agents: { t3: runner as any }, storage: cell.storage, logger: false });
      if (engine !== 'plain') {
        expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
      }

      const thread = `t3-thread-${provider}-${engine}`;
      const resource = `t3-resource-${provider}-${engine}`;
      const run = await streamTurn(runner, engine, PROMPT, {
        memory: { thread, resource },
        maxSteps: 5,
      });
      await mastra.stopWorkers?.();
      const messages = await persistedMessages(cell.memory, thread, resource);
      await cell.cleanup();
      return { scores, onComplete, run, messages };
    }

    it('pass: one committed score, one model request, one persisted user message', async () => {
      const { scores, onComplete, run, messages } = await runCell(scores => createAlwaysPassingScorer(scores), 'pass');
      const { chunks, threw, finishPayloads, errorPayloads } = run;

      const repairs = prefillRepairs(recorder.requests);
      expect(repairs.unrepaired).toEqual([]);
      expect(repairs.spurious).toEqual([]);
      expect(errorChunks(chunks)).toEqual([]);
      expect(threw).toBeNull();
      // Exactly one finish, one onFinish and no onError.
      expect(chunksOfType(chunks, 'finish')).toHaveLength(1);
      expect(finishPayloads).toHaveLength(1);
      expect(errorPayloads).toEqual([]);
      // The scorer ran once and the model was asked once.
      expect(scores).toHaveLength(1);
      expect(recorder.requests).toHaveLength(1);
      // One `onComplete` per committed scorer run, carrying the commitment.
      expect(onComplete).toEqual([true]);
      // Exactly one persisted user message.
      expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
    });

    it('failonce: scores 0 then 1, delivers and persists the feedback exactly once', async () => {
      const { scores, onComplete, run, messages } = await runCell(
        scores => createScorerThatFailsOnce(scores),
        'failonce',
      );
      const { chunks, threw, finishPayloads, errorPayloads } = run;

      const repairs = prefillRepairs(recorder.requests);
      expect(repairs.unrepaired).toEqual([]);
      expect(repairs.spurious).toEqual([]);
      expect(errorChunks(chunks)).toEqual([]);
      expect(threw).toBeNull();
      expect(chunksOfType(chunks, 'finish')).toHaveLength(1);
      expect(finishPayloads).toHaveLength(1);
      expect(errorPayloads).toEqual([]);

      expect(scores).toEqual([0, 1]);
      expect(onComplete).toEqual([false, true]);

      // The feedback reached the model, in a request after the first one.
      const bodies = recorder.requests.map((r: ModelRequest) => JSON.stringify(r.body ?? ''));
      expect(bodies.length).toBeGreaterThan(1);
      expect(bodies.slice(1).some(b => b.includes(FEEDBACK))).toBe(true);
      // Exactly one persisted user message, and the feedback is stored exactly once.
      expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
      const stored = messages.map(messageText).join('\n');
      expect(stored.split(FEEDBACK).length - 1).toBe(1);
    });

    it('throws: a failing scorer never hangs the run', async () => {
      const { run } = await runCell(
        () =>
          createScorer({ id: 't3-scorer', description: 'throws before scoring' })
            .generateScore(async () => {
              throw new Error('scorer exploded');
            })
            .generateReason(async () => 'scorer exploded'),
        'throws',
      );
      const { chunks, finishPayloads, errorPayloads } = run;

      // The contract only requires settling: one finish with its callback, or an error with onError.
      const settled = finishPayloads.length === 1 || (errorChunks(chunks).length > 0 && errorPayloads.length > 0);
      expect(settled).toBe(true);
    }, 180_000);
  });
});
