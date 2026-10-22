/**
 * Port of harness case T8 (goal judge) onto the LLM recorder.
 *
 * A thread objective is set, the model replies, and a real judge model grades the reply against
 * the objective. The judged cell must store the objective, settle with one finish, and end on a
 * final non-pending `goal` chunk with `passed: true`.
 *
 * The `judgefail` variant points the judge at a nonexistent model. That cell only has to settle
 * (no hang, no lost run) — the harness records its shape as the D5 reference-vs-candidate
 * comparison point rather than asserting a verdict.
 *
 * Excluded, per the harness: restart, redelivery, exact prose/token/timing equality, and judge
 * verdict wording.
 *
 * Replay is the default: traffic is served from `packages/memory/__recordings__/`. To re-record
 * (needs OPENAI_API_KEY and ANTHROPIC_API_KEY), from `packages/memory/integration-tests`:
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-goal-judge.test.ts
 */
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ENGINES,
  PROVIDERS,
  chunksOfType,
  createCellMemory,
  errorChunks,
  recordProviderRequests,
  streamTurn,
} from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-goal-judge';
const OBJECTIVE = 'The assistant has replied with the word DONE.';
const PROMPT = 'Reply with the single word DONE.';
const BAD_JUDGE = 'openai/cor-1252-no-such-model';

describe.each(Object.entries(PROVIDERS))('T8 goal judge — %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    let mock: ReturnType<typeof createGatewayMock>;
    let recorder: ReturnType<typeof recordProviderRequests>;

    beforeEach(() => {});

    afterEach(async () => {
      recorder.restore();
      await mock.saveAndStop();
    });

    async function runCell(judge: string, variant: string) {
      mock = createGatewayMock({
        name: `${RECORDING_NAME}-${provider}-${engine}-${variant}`,
        exactMatch: true,
        transformRequest,
      });
      mock.start();
      recorder = recordProviderRequests();
      const cell = await createCellMemory(`t8-${provider}-${engine}-${variant}`);
      const agent = new Agent({
        id: `t8-agent-${provider}-${engine}-${variant}`,
        name: 't8',
        model,
        memory: cell.memory,
        instructions: 'Answer briefly and follow the instruction exactly.',
        goal: { judge, maxRuns: 5 },
      });
      const runner =
        engine === 'plain'
          ? agent
          : engine === 'durable'
            ? createDurableAgent({ agent })
            : createEventedAgent({ agent });
      const mastra = new Mastra({ agents: { t8: runner as any }, storage: cell.storage, logger: false });
      if (engine !== 'plain') {
        expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
      }

      const thread = `t8-thread-${provider}-${engine}-${variant}`;
      const resource = `t8-resource-${provider}-${engine}-${variant}`;
      const storedObjective = await (runner as any).setObjective(OBJECTIVE, { threadId: thread, resourceId: resource });
      const run = await streamTurn(runner, engine, PROMPT, {
        memory: { thread, resource },
        maxSteps: 4,
      });
      await mastra.stopWorkers?.();
      await cell.cleanup();
      return { storedObjective, run };
    }

    it('judged: stores the objective and ends on a passing goal chunk', async () => {
      const { storedObjective, run } = await runCell(model, 'judged');
      const { chunks, threw, finishPayloads, errorPayloads } = run;

      expect(storedObjective).toBeDefined();
      expect(threw).toBeNull();
      expect(errorChunks(chunks)).toEqual([]);
      expect(chunksOfType(chunks, 'finish')).toHaveLength(1);
      expect(finishPayloads).toHaveLength(1);
      expect(errorPayloads).toEqual([]);

      const goalChunks = chunks.filter((c: any) => c.type === 'goal' && !c.payload?.pending);
      expect(goalChunks.length).toBeGreaterThan(0);
      expect(goalChunks.at(-1)?.payload).toMatchObject({ objective: OBJECTIVE, passed: true });
    });

    it('judgefail: settles instead of hanging when the judge model is unavailable', async () => {
      const { run } = await runCell(BAD_JUDGE, 'judgefail');
      const { chunks, finishPayloads, errorPayloads } = run;

      // The observed shape is the D5 comparison point, so only settling is asserted: either the
      // run finishes, or it surfaces an error through the stream/`onError`. A hang fails the test
      // timeout instead.
      const finished = chunksOfType(chunks, 'finish').length > 0;
      const errored = errorChunks(chunks).length > 0 || errorPayloads.length > 0;
      expect(finished || errored).toBe(true);
      expect(finishPayloads.length + errorPayloads.length).toBeGreaterThan(0);
    }, 150_000);
  });
});
