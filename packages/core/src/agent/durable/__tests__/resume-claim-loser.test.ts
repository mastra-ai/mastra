/**
 * The losing side of a resume claim (#27365).
 *
 * A resume that cannot drive the run — because the run already finished or
 * because another resume of it is running — must fail on its own stream
 * without touching the run: no error on the run's shared topic, no new
 * workflow row, no second tool execution.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { ExecutionFence, __resetExecutionFencesForTests } from '../execution-fence';
import { globalRunRegistry } from '../run-registry';

function toolCallThenTextModel(toolName: string, text: string) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const body =
        calls === 1
          ? [
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-1',
                toolName,
                input: JSON.stringify({ item: 'a' }),
                providerExecuted: false,
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]
          : [
              { type: 'text-start' as const, id: 'text-1' },
              { type: 'text-delta' as const, id: 'text-1', delta: text },
              { type: 'text-end' as const, id: 'text-1' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `resp-${calls}`, modelId: 'mock', timestamp: new Date(0) },
          ...body,
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, calls: () => calls };
}

async function drain(stream: ReadableStream<any> | AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream as AsyncIterable<any>) chunks.push(chunk);
  return chunks;
}

describe('DurableAgent resume claim loser (#27365)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
    __resetExecutionFencesForTests();
    await pubsub.close();
  });

  function setup(execute: (input: { item: string }) => Promise<unknown>) {
    const storage = new InMemoryStore();
    const model = toolCallThenTextModel('archive', 'archived');
    const archive = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      requireApproval: true,
      execute,
    });
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'loser-agent',
        name: 'Loser Agent',
        instructions: 'You archive items.',
        model: model.model as LanguageModelV2,
        tools: { archive },
      }),
      pubsub,
    });
    new Mastra({ agents: { 'loser-agent': durableAgent as any }, logger: false, storage, pubsub });
    return { storage, model, durableAgent };
  }

  async function suspend(durableAgent: ReturnType<typeof setup>['durableAgent']) {
    let suspended = false;
    const started = await durableAgent.stream('Archive a', {
      requireToolApproval: true,
      onSuspended: () => {
        suspended = true;
      },
    });
    await vi.waitFor(() => expect(suspended).toBe(true));
    await ExecutionFence.getLocalActive(started.runId)?.whenSettled;
    return started.runId;
  }

  async function workflowRow(storage: InMemoryStore, runId: string) {
    const workflows = (await storage.getStore('workflows'))!;
    return workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
  }

  async function watchTopicErrors(runId: string) {
    const errors: unknown[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
      if (event?.type === AgentStreamEventTypes.ERROR) errors.push(event.data);
    });
    return errors;
  }

  it('rejects a warm resume of a run whose snapshot is gone without writing a new row', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const { storage, model, durableAgent } = setup(execute);
    const runId = await suspend(durableAgent);

    // Another process finished the run and deleted its snapshot; this process still has it warm.
    const workflows = (await storage.getStore('workflows'))!;
    await workflows.deleteWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    expect(globalRunRegistry.has(runId)).toBe(true);
    const createRun = vi.spyOn(durableAgent.getWorkflow(), 'createRun');
    const topicErrors = await watchTopicErrors(runId);

    await expect(durableAgent.resume(runId, { approved: true })).rejects.toMatchObject({
      id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
    });

    expect(createRun).not.toHaveBeenCalled();
    expect(await workflowRow(storage, runId)).toBeNull();
    expect(topicErrors).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    expect(model.calls()).toBe(1);
  });

  it('fails a second approval of a tool call fast while the first resume is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let started!: () => void;
    const executing = new Promise<void>(resolve => {
      started = resolve;
    });
    const execute = vi.fn(async () => {
      started();
      await gate;
      return { ok: true };
    });
    const { durableAgent } = setup(execute);
    const runId = await suspend(durableAgent);

    const winner = await durableAgent.resume(runId, { approved: true }, { toolCallId: 'call-1' } as any);
    const winnerChunks = drain(winner.fullStream);
    await executing;

    const startedAt = Date.now();
    await expect(durableAgent.approveToolCall({ runId, toolCallId: 'call-1' })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);

    release();
    const chunks = await winnerChunks;
    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('reports a lost resume race only on the losing stream', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const { durableAgent } = setup(execute);
    const runId = await suspend(durableAgent);
    const topicErrors = await watchTopicErrors(runId);

    // The run was suspended when this resume claimed it, but another resume ran it first.
    const workflow = durableAgent.getWorkflow();
    const createRun = workflow.createRun.bind(workflow);
    vi.spyOn(workflow, 'createRun').mockImplementation(async (...args) => {
      const run = await createRun(...args);
      vi.spyOn(run, 'resume').mockRejectedValue(
        new MastraError({
          id: 'WORKFLOW_RUN_NOT_SUSPENDED',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.USER,
          text: 'This workflow run was not suspended',
        }),
      );
      return run;
    });

    const loser = await durableAgent.resume(runId, { approved: true });
    const chunks = await drain(loser.fullStream);
    loser.cleanup();

    expect(chunks.find(chunk => chunk.type === 'error')?.payload?.error).toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(topicErrors).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('execution lease timing', () => {
  afterEach(() => {
    delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
    delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
    vi.resetModules();
  });

  it('follows the agent thread lease TTL', async () => {
    vi.resetModules();
    const defaults = await import('../execution-fence');
    expect(defaults.EXECUTION_LEASE_TTL_MS).toBe(15_000);
    expect(defaults.EXECUTION_LEASE_RENEW_INTERVAL_MS).toBe(5_000);

    process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '6000';
    vi.resetModules();
    const overridden = await import('../execution-fence');
    expect(overridden.EXECUTION_LEASE_TTL_MS).toBe(6_000);
    expect(overridden.EXECUTION_LEASE_RENEW_INTERVAL_MS).toBe(2_000);
  });

  it('ignores a renew interval that is not shorter than the TTL', async () => {
    process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = '20000';
    vi.resetModules();
    const tooLong = await import('../execution-fence');
    expect(tooLong.EXECUTION_LEASE_TTL_MS).toBe(15_000);
    expect(tooLong.EXECUTION_LEASE_RENEW_INTERVAL_MS).toBe(5_000);

    process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '2';
    delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
    vi.resetModules();
    const tiny = await import('../execution-fence');
    expect(tiny.EXECUTION_LEASE_RENEW_INTERVAL_MS).toBe(1);
  });
});
