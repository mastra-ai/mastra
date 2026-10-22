/**
 * Port of durable-agent-validation harness case **T21** (`goal-recovery`) onto the
 * `@internal/llm-recorder`.
 *
 * A goal-configured agent calls a tool once and then replies "DONE"; a real judge model grades
 * the reply against the thread objective. The case proves the judge runs, that its verdict is
 * surfaced as a settled `goal` chunk with `passed: true`, and that the run finishes exactly once.
 *
 * Conditions ported here: `plain`, `durable` and `evented`.
 *
 * Declared differences from the harness, per COR-1443:
 *   - `durable-recover` and `evented-recover` kill the process during the tool call, before the
 *     judge runs, so the recovered process has to rebuild the goal config from the registered
 *     agent. Reproducing that in-tree needs a real process death (COR-1365 records SIGKILL being
 *     replaced by a fresh-module-graph restart), and `EventedAgent` exposes no `recover()` at all,
 *     so both cells are pinned to the restart-family work rather than asserted here. The
 *     non-recovery cells still hold the goal half of the contract.
 *
 * Re-record with
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-goal-recovery.test.ts
 */
import { randomUUID } from 'node:crypto';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ENGINES,
  PROVIDERS,
  chunksOfType,
  createCellMemory,
  errorChunks,
  prefillRepairs,
  recordProviderRequests,
  streamTurn,
  useRecordedMock,
} from './durable-harness-helpers';
import type { Engine } from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-goal-recovery';

const OBJECTIVE = 'The assistant has replied with the word DONE.';
const PROMPT = 'Call the step tool once, then reply with the single word DONE.';

setupDummyApiKeys(MODE, ['openai', 'anthropic']);

function stepTool() {
  return createTool({
    id: 'step',
    description: 'Take one step. Returns 1.',
    inputSchema: z.object({}),
    execute: async () => ({ step: 1 }),
  } as any);
}

describe.each(Object.entries(PROVIDERS))('T21 goal recovery · %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    useRecordedMock(`${RECORDING_NAME}-${provider}-${engine}`, { transformRequest });
    let recorder: ReturnType<typeof recordProviderRequests>;

    beforeEach(() => {
      recorder = recordProviderRequests();
    });

    afterEach(() => {
      recorder.restore();
    });

    it('judges the reply against the thread objective', async () => {
      const { storage, memory, cleanup } = await createCellMemory(`t21-${provider}-${engine}`);
      const thread = `t21-thread-${provider}-${engine}`;
      const resource = `t21-resource-${provider}-${engine}`;

      const agent = new Agent({
        id: `t21-agent-${provider}-${engine}`,
        name: 't21',
        model,
        memory,
        instructions: 'Follow the instructions exactly.',
        tools: { step: stepTool() },
        goal: { judge: model, maxRuns: 5 },
      } as any);

      const runner =
        engine === 'plain'
          ? agent
          : engine === 'durable'
            ? createDurableAgent({ agent })
            : createEventedAgent({ agent });

      const mastra = new Mastra({
        logger: false,
        storage,
        agents: { [agent.id]: runner as any },
      } as any);
      await (mastra as any).startWorkers?.();

      const storedObjective = await (runner as any).setObjective(OBJECTIVE, { threadId: thread, resourceId: resource });
      expect(storedObjective).toBeDefined();

      const { chunks, threw, finishPayloads, errorPayloads } = await streamTurn(runner, engine as Engine, PROMPT, {
        memory: { thread, resource },
        runId: `t21-run-${provider}-${engine}-${randomUUID()}`,
        maxSteps: 4,
      });

      try {
        expect(threw).toBeNull();
        expect(errorChunks(chunks)).toEqual([]);
        expect(errorPayloads).toEqual([]);

        // Exactly one finish, and one settled goal verdict that the objective was met.
        expect(chunksOfType(chunks, 'finish')).toHaveLength(1);
        expect(finishPayloads).toHaveLength(1);

        const goalChunks = chunks.filter((chunk: any) => chunk.type === 'goal' && !chunk.payload?.pending);
        expect(goalChunks).toHaveLength(1);
        expect(goalChunks[0].payload).toMatchObject({ objective: OBJECTIVE, passed: true });

        // F7 (COR-1312): the judge's requests are still subject to the prefill repair path.
        const repairs = prefillRepairs(recorder.requests);
        expect(repairs.unrepaired).toEqual([]);
        expect(repairs.spurious).toEqual([]);
      } finally {
        await (mastra as any).stopWorkers?.();
        await cleanup();
      }
    }, 180_000);
  });
});
