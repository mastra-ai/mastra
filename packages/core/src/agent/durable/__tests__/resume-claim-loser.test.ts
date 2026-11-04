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
import type { AgentExecutionOptions } from '../../agent.types';
import type { AgentConfig } from '../../types';
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

  function setup(
    execute: (input: { item: string }) => Promise<unknown>,
    defaultOptions?: AgentConfig['defaultOptions'],
  ) {
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
        defaultOptions,
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

  it.each(['per-call', 'default', 'dynamic-default', 'persisted'] as const)(
    'rejects invalid %s timeouts before cold resume recovery can change the run (COR-1426)',
    async mode => {
      const execute = vi.fn(async () => ({ ok: true }));
      const defaults: AgentExecutionOptions = { modelSettings: { timeout: { stepMs: 30_000 } } };
      const resolveDefaults = vi.fn(() => defaults);
      const { storage, model, durableAgent } = setup(execute, mode === 'dynamic-default' ? resolveDefaults : defaults);
      const runId = await suspend(durableAgent);
      const workflows = (await storage.getStore('workflows'))!;
      const row = (await workflowRow(storage, runId))!;
      const suspendedSnapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
      if (mode === 'persisted') {
        suspendedSnapshot.context.input.options.modelSettings = { timeout: { stepMs: -1 } };
      }
      // Model a process dying after claiming the suspended run, before continuing it.
      await workflows.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
        snapshot: { ...suspendedSnapshot, status: 'running' },
      });
      globalRunRegistry.delete(runId);
      const before = await workflowRow(storage, runId);
      const runningSnapshot = typeof before!.snapshot === 'string' ? JSON.parse(before!.snapshot) : before!.snapshot;
      expect(runningSnapshot.status).toBe('running');
      expect(globalRunRegistry.has(runId)).toBe(false);
      const coldAgent = createDurableAgent({ agent: durableAgent.agent, pubsub });
      new Mastra({ agents: { 'loser-agent': coldAgent }, logger: false, storage, pubsub });
      const recover = vi.spyOn(coldAgent, 'recoverActiveRuns');
      if (mode === 'default') defaults.modelSettings = { timeout: { stepMs: -1 } };
      resolveDefaults.mockClear();

      await expect(
        coldAgent.resume(
          runId,
          { approved: true },
          mode === 'per-call' || mode === 'dynamic-default' ? { modelSettings: { timeout: { stepMs: -1 } } } : {},
        ),
      ).rejects.toThrow(TypeError);
      expect(recover).not.toHaveBeenCalled();
      expect(resolveDefaults).not.toHaveBeenCalled();
      expect(await workflowRow(storage, runId)).toEqual(before);
      expect(execute).not.toHaveBeenCalled();
      expect(model.calls()).toBe(1);

      if (mode === 'persisted') {
        runningSnapshot.context.input.options.modelSettings = { timeout: { stepMs: 30_000 } };
        await workflows.persistWorkflowSnapshot({
          workflowName: DurableStepIds.AGENTIC_LOOP,
          runId,
          snapshot: runningSnapshot,
        });
      }
      const resumed = await coldAgent.resume(
        runId,
        { approved: true },
        { modelSettings: { timeout: { stepMs: 30_000 } } },
      );
      await drain(resumed.fullStream);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(model.calls()).toBe(2);
    },
  );

  it('rejects a terminal cold run before inspecting its input or taking a recovery claim', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const { storage, durableAgent } = setup(execute);
    const runId = await suspend(durableAgent);
    const workflows = (await storage.getStore('workflows'))!;
    const row = (await workflowRow(storage, runId))!;
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
      snapshot: { ...snapshot, status: 'success', context: {} },
    });
    globalRunRegistry.delete(runId);
    const coldAgent = createDurableAgent({ agent: durableAgent.agent, pubsub });
    new Mastra({ agents: { 'loser-agent': coldAgent }, logger: false, storage, pubsub });
    const recover = vi.spyOn(coldAgent, 'recoverActiveRuns');

    await expect(coldAgent.resume(runId, { approved: true })).rejects.toMatchObject({
      id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
    });
    expect(recover).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

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

  it('reports a resume that loses the persisted claim as AGENT_RESUME_ALREADY_CLAIMED (#27619)', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const { storage, durableAgent } = setup(execute);
    const runId = await suspend(durableAgent);
    const topicErrors = await watchTopicErrors(runId);
    const workflows = (await storage.getStore('workflows'))!;

    // Another process claims the row after this resume read it as suspended but before its
    // own claim lands, so the real claim CAS (suspended -> running) loses.
    const updateWorkflowState = workflows.updateWorkflowState.bind(workflows);
    let competed = false;
    vi.spyOn(workflows, 'updateWorkflowState').mockImplementation(async args => {
      if (!competed && args.runId === runId && args.opts.expectedStatus === 'suspended') {
        competed = true;
        await updateWorkflowState({ workflowName: args.workflowName, runId, opts: { ...args.opts } });
      }
      return updateWorkflowState(args);
    });

    const loser = await durableAgent.resume(runId, { approved: true });
    const chunks = await drain(loser.fullStream);
    loser.cleanup();

    expect(chunks.find(chunk => chunk.type === 'error')?.payload?.error).toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(topicErrors).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    expect((await workflowRow(storage, runId))?.snapshot).toMatchObject({ status: 'running' });
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
