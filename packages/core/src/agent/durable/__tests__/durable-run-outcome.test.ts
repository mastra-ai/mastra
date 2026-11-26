import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { commitDurableRunOutcome, readDurableRunOutcome } from '../run-outcome';
import { getRunRegistryEntry } from '../run-registry';

it('commits the generated answer before terminal stream cleanup', async () => {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: 'text' as const, text: 'Persisted answer' }],
    finishReason: 'stop' as const,
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    warnings: [],
  }));
  const doStream = vi.fn(async () => {
    throw new Error('provider streaming was not requested');
  });
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'retained-run-test',
      model: new MockLanguageModelV2({ doGenerate, doStream }),
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', {
      modelCallMode: 'generate',
      retainOutcome: true,
      closeOnSuspend: true,
    });
    const answer = await started.output.getFullOutput();
    started.cleanup();
    const outcome = await readDurableRunOutcome(mastra, started.runId);
    expect(answer.text).toBe('Persisted answer');
    expect(outcome).toMatchObject({
      runId: started.runId,
      agentId: agent.id,
      status: 'success',
      result: { text: 'Persisted answer', finishReason: 'stop' },
    });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
  } finally {
    await mastra.shutdown();
  }
});

it('retains the parsed structured object', async () => {
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'object-outcome-test',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: '{"amount":42}' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
      }),
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', {
      modelCallMode: 'generate',
      retainOutcome: true,
      structuredOutput: { schema: z.object({ amount: z.number() }) },
    });
    expect((await started.output.getFullOutput()).object).toEqual({ amount: 42 });
    expect((await readDurableRunOutcome(mastra, started.runId))?.result?.object).toEqual({ amount: 42 });
    started.cleanup();
  } finally {
    await mastra.shutdown();
  }
});

it('retains an evented result while calling the provider generate method', async () => {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: 'text' as const, text: 'Evented answer' }],
    finishReason: 'stop' as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    warnings: [],
  }));
  const doStream = vi.fn(async () => {
    throw new Error('unexpected stream');
  });
  const agent = createEventedAgent({
    agent: new Agent({ id: 'evented-retained-test', model: new MockLanguageModelV2({ doGenerate, doStream }) }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    expect((agent.getWorkflow() as { engineType?: string }).engineType).toBe('evented');
    const started = await agent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    expect((await started.output.getFullOutput()).text).toBe('Evented answer');
    expect(await readDurableRunOutcome(mastra, started.runId)).toMatchObject({
      status: 'success',
      result: { text: 'Evented answer' },
    });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
    started.cleanup();
  } finally {
    await mastra.shutdown();
  }
});

it('keeps an in-flight checkpoint for an acknowledged run without auto recovery', async () => {
  let release!: () => void;
  let entered!: () => void;
  const providerEntered = new Promise<void>(resolve => {
    entered = resolve;
  });
  const providerGate = new Promise<void>(resolve => {
    release = resolve;
  });
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'checkpoint-test',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          entered();
          await providerGate;
          return {
            content: [{ type: 'text', text: 'After checkpoint' }],
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            warnings: [],
          };
        },
      }),
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    await providerEntered;
    const store = await mastra.getStorage()?.getStore('workflows');
    const row = await store?.getWorkflowRunById({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: started.runId });
    const snapshot = typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
    expect(snapshot?.status).toBe('running');
    expect(snapshot?.context?.input?.options?.modelCallMode).toBe('generate');
    release();
    await started.output.getFullOutput();
    started.cleanup();
    expect((await readDurableRunOutcome(mastra, started.runId))?.result?.text).toBe('After checkpoint');
    await vi.waitFor(async () => {
      expect(
        await store?.getWorkflowRunById({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: started.runId }),
      ).toBeNull();
    });
    // Simulate a crash after outcome commit but before snapshot cleanup.
    await store?.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId: started.runId,
      snapshot,
    });
    const recovered = await agent.recoverActiveRuns({ runId: started.runId });
    expect(recovered.recovered).toEqual([]);
    expect(
      await store?.getWorkflowRunById({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: started.runId }),
    ).toBeNull();
  } finally {
    release?.();
    await mastra.shutdown();
  }
});

it('retains a terminal failure instead of deleting its only recoverable record', async () => {
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'failure-outcome-test',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('provider unavailable');
        },
      }),
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    await started.output.getFullOutput().catch(() => {});
    await vi.waitFor(async () => {
      expect(await readDurableRunOutcome(mastra, started.runId)).toMatchObject({
        status: 'failed',
      });
    });
    started.cleanup();
  } finally {
    await mastra.shutdown();
  }
});

it('retains a processor tripwire without presenting the rejected text as success', async () => {
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'tripwire-outcome-test',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Rejected answer' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
      }),
      outputProcessors: [{ id: 'gate', processOutputResult: ({ abort }) => abort('rejected by gate') }],
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    await started.output.getFullOutput();
    expect(await readDurableRunOutcome(mastra, started.runId)).toMatchObject({
      status: 'tripwire',
      result: { tripwire: { reason: 'rejected by gate' } },
    });
    started.cleanup();
  } finally {
    await mastra.shutdown();
  }
});

it('retains cancellation as a terminal outcome', async () => {
  let entered!: () => void;
  const providerEntered = new Promise<void>(resolve => {
    entered = resolve;
  });
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'canceled-outcome-test',
      model: new MockLanguageModelV2({
        doGenerate: async ({ abortSignal }) => {
          entered();
          await new Promise<void>((_, reject) => {
            if (abortSignal?.aborted) reject(abortSignal.reason);
            else abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true });
          });
          throw new Error('unreachable');
        },
      }),
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage: new InMemoryStore(), logger: false });
  try {
    const started = await agent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    await providerEntered;
    await started.abort();
    await started.output.getFullOutput().catch(() => {});
    await vi.waitFor(async () => {
      expect(await readDurableRunOutcome(mastra, started.runId)).toMatchObject({ status: 'canceled' });
    });
    started.cleanup();
  } finally {
    await mastra.shutdown();
  }
});

it('does not commit a terminal outcome on suspension and keeps generate mode on resume', async () => {
  const doGenerate = vi.fn(async () => {
    const resumed = doGenerate.mock.calls.length > 1;
    return {
      content: resumed
        ? [{ type: 'text' as const, text: 'Confirmed' }]
        : [
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: 'approval-1',
              toolName: 'confirm',
              input: '{}',
            },
          ],
      finishReason: resumed ? ('stop' as const) : ('tool-calls' as const),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    };
  });
  const doStream = vi.fn(async () => {
    throw new Error('unexpected stream');
  });
  const storage = new InMemoryStore();
  const confirm = createTool({
    id: 'confirm',
    description: 'Ask for confirmation',
    inputSchema: z.object({}),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async (_input, context) =>
      context?.agent?.resumeData ? { confirmed: true } : context?.agent?.suspend({ question: 'Proceed?' }),
  });
  const agent = createDurableAgent({
    agent: new Agent({
      id: 'suspended-outcome-test',
      model: new MockLanguageModelV2({ doGenerate, doStream }),
      memory: new MockMemory({ storage }),
      tools: { confirm },
    }),
  });
  const mastra = new Mastra({ agents: { test: agent }, storage, logger: false });
  const memory = { thread: 'suspended-outcome-thread', resource: 'suspended-outcome-resource' };
  let otherWorker: Mastra | undefined;
  try {
    const started = await agent.stream('Hello', {
      memory,
      maxSteps: 3,
      modelCallMode: 'generate',
      retainOutcome: true,
      closeOnSuspend: true,
    });
    const suspended = await started.output.getFullOutput();
    expect(suspended.finishReason).toBe('suspended');
    expect(await readDurableRunOutcome(mastra, started.runId)).toBeNull();
    started.cleanup();
    const recoveredGenerate = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'Confirmed' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    const recoveredStream = vi.fn(async () => {
      throw new Error('unexpected recovered stream');
    });
    const resumedAgent = createDurableAgent({
      agent: new Agent({
        id: 'suspended-outcome-test',
        model: new MockLanguageModelV2({ doGenerate: recoveredGenerate, doStream: recoveredStream }),
        memory: new MockMemory({ storage }),
        tools: { confirm },
      }),
    });
    otherWorker = new Mastra({ agents: { test: resumedAgent }, storage, logger: false });
    const resumed = await resumedAgent.resume(started.runId, { confirmed: true }, {
      toolCallId: 'approval-1',
      memory,
      closeOnSuspend: true,
    } as any);
    expect((await resumed.output.getFullOutput()).text).toBe('Confirmed');
    expect(await readDurableRunOutcome(mastra, started.runId)).toMatchObject({
      status: 'success',
      result: { text: 'Confirmed' },
    });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
    expect(recoveredGenerate).toHaveBeenCalledTimes(1);
    expect(recoveredStream).not.toHaveBeenCalled();
    resumed.cleanup();
  } finally {
    await mastra.shutdown();
    await otherWorker?.shutdown();
  }
});

it('recovers a generated turn from a running checkpoint on a fresh worker', async () => {
  let entered!: () => void;
  let release!: () => void;
  const providerEntered = new Promise<void>(resolve => {
    entered = resolve;
  });
  const providerGate = new Promise<void>(resolve => {
    release = resolve;
  });
  const firstStore = new InMemoryStore();
  const firstAgent = createDurableAgent({
    agent: new Agent({
      id: 'generated-recovery-test',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          entered();
          await providerGate;
          return {
            content: [{ type: 'text', text: 'First worker' }],
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            warnings: [],
          };
        },
      }),
    }),
  });
  const first = new Mastra({ agents: { test: firstAgent }, storage: firstStore, logger: false });
  let second: Mastra | undefined;
  try {
    const started = await firstAgent.stream('Hello', { modelCallMode: 'generate', retainOutcome: true });
    await providerEntered;
    const store = await firstStore.getStore('workflows');
    const rows = await Promise.all(
      [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION].map(workflowName =>
        store?.getWorkflowRunById({ workflowName, runId: started.runId }),
      ),
    );
    expect(rows[0]?.snapshot).toMatchObject({ status: 'running' });
    expect(rows[1]?.snapshot).toBeDefined();
    const checkpoints = rows.map(
      row =>
        row && {
          workflowName: row.workflowName,
          runId: row.runId,
          resourceId: row.resourceId ?? undefined,
          snapshot: structuredClone(row.snapshot),
        },
    );
    release();
    await started.output.getFullOutput();
    await getRunRegistryEntry(started.runId, first)?.workflowExecution;
    started.cleanup();

    vi.resetModules(); // fresh run registry and execution fences, as on a new worker
    const [
      { InMemoryStore: FreshStore },
      { Mastra: FreshMastra },
      { Agent: FreshAgent },
      { createDurableAgent: createFreshDurableAgent },
    ] = await Promise.all([
      import('../../../storage'),
      import('../../../mastra'),
      import('../../agent'),
      import('../create-durable-agent'),
    ]);
    const secondStore = new FreshStore();
    const secondStoreWorkflows = await secondStore.getStore('workflows');
    for (const checkpoint of checkpoints) {
      if (checkpoint) await secondStoreWorkflows?.persistWorkflowSnapshot(checkpoint);
    }
    const recoveredGenerate = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'Recovered answer' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }));
    const recoveredStream = vi.fn(async () => {
      throw new Error('recovery streamed the provider');
    });
    const secondAgent = createFreshDurableAgent({
      agent: new FreshAgent({
        id: 'generated-recovery-test',
        model: new MockLanguageModelV2({ doGenerate: recoveredGenerate, doStream: recoveredStream }),
      }),
    });
    second = new FreshMastra({ agents: { test: secondAgent }, storage: secondStore, logger: false });
    const recovered = await secondAgent.recover(started.runId);
    expect((await recovered.output.getFullOutput()).text).toBe('Recovered answer');
    expect((await readDurableRunOutcome(second, started.runId))?.result?.text).toBe('Recovered answer');
    expect(recoveredGenerate).toHaveBeenCalledTimes(1);
    expect(recoveredStream).not.toHaveBeenCalled();
    recovered.cleanup();
  } finally {
    release?.();
    await first.shutdown();
    await second?.shutdown();
  }
});
