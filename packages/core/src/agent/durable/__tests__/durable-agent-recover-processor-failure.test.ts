/**
 * recover() when processors or memory cannot be resolved (#29137).
 *
 * Right after a restart a processor or memory resolver can throw (storage or
 * embedder not ready yet). recover() must reject before calling the model, as
 * step-level rehydration does, instead of running the recovered turn without
 * its processors or memory. Once the resolver works, a retry recovers the run.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import { DurableStepIds } from '../constants';

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
type Checkpoint = { rows: SnapshotRow[]; requestsSoFar: number };
type Broken = 'processors' | 'memory';

let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});

afterAll(async () => {
  await llm.stop();
});

beforeEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }] },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
});

async function startProcess(broken: Broken) {
  vi.resetModules();
  const [
    { Mastra },
    { InMemoryStore },
    { Agent },
    { createDurableAgent },
    { MockMemory },
    { DurableProcessorRebuildError },
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../../../memory/mock'),
    import('../utils/resolve-runtime'),
  ]);
  // Resolvers work while the agent is built and fail only once `down` is set.
  const state = { down: false, outputProcessorRuns: 0 };
  const resolverDown = () => {
    throw new Error('RESOLVER_DOWN');
  };
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` });
  const agent = new Agent({
    id: 'recover-processors-agent',
    name: 'recover-processors-agent',
    instructions: 'Use your tools.',
    model: openai.chat('gpt-4o-mini'),
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      },
    },
    inputProcessors: () => (state.down && broken === 'processors' ? resolverDown() : []),
    outputProcessors: () =>
      state.down && broken === 'processors'
        ? resolverDown()
        : [
            {
              id: 'counter',
              processOutputResult: ({ messages }) => {
                state.outputProcessorRuns++;
                return messages;
              },
            },
          ],
    memory: () => (state.down && broken === 'memory' ? resolverDown() : memory),
  });
  const durableAgent = createDurableAgent({ agent });
  const mastra = new Mastra({
    agents: { recoverProcessorsAgent: durableAgent },
    storage,
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, state, DurableProcessorRebuildError };
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

/** Runs a tool round-trip and returns the last snapshot taken between the two model calls. */
async function crashBetweenModelCalls(broken: Broken) {
  const original = await startProcess(broken);
  const rows = new Map<string, SnapshotRow>();
  const checkpoints: Checkpoint[] = [];
  const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
  original.workflows.persistWorkflowSnapshot = async args => {
    rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
    checkpoints.push({
      rows: [...rows.values()].map(row => structuredClone(row)),
      requestsSoFar: llm.getRequests().length,
    });
    return persist(args);
  };

  const result = await original.durableAgent.stream('Look it up', {
    memory: { thread: 'thread-1', resource: 'user-1' },
  });
  await drain(result);
  expect(llm.getRequests()).toHaveLength(2);
  expect(original.state.outputProcessorRuns).toBe(1);

  const midRun = checkpoints.filter(
    ({ rows, requestsSoFar }) =>
      requestsSoFar === 1 &&
      rows.some(row => row.workflowName === DurableStepIds.AGENTIC_LOOP && row.snapshot.status === 'running') &&
      rows.some(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP),
  );
  expect(midRun.length).toBeGreaterThan(0);
  llm.clearRequests();
  return { runId: result.runId, checkpoint: midRun.at(-1)! };
}

describe('DurableAgent.recover() with failing resolvers', () => {
  it.each<Broken>(['processors', 'memory'])(
    'rejects before calling the model when %s cannot be resolved, then recovers on retry',
    async broken => {
      const { runId, checkpoint } = await crashBetweenModelCalls(broken);

      const restarted = await startProcess(broken);
      for (const row of checkpoint.rows) await restarted.workflows.persistWorkflowSnapshot(row);

      restarted.state.down = true;
      const failure = await restarted.durableAgent.recover(runId).then(
        () => undefined,
        error => error,
      );
      expect(failure).toBeInstanceOf(restarted.DurableProcessorRebuildError);
      expect(String(failure?.message)).toContain('RESOLVER_DOWN');
      expect(llm.getRequests()).toHaveLength(0);
      expect(restarted.state.outputProcessorRuns).toBe(0);

      // The failed attempt released its claim and left the run recoverable.
      restarted.state.down = false;
      await drain(await restarted.durableAgent.recover(runId));
      expect(llm.getRequests()).toHaveLength(1);
      expect(restarted.state.outputProcessorRuns).toBe(1);
    },
    60_000,
  );
});
