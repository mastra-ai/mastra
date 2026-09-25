/**
 * Regression test for #24749: resuming a durable Inngest agent right after a tool suspends
 * (here in loop iteration 2) must resume the suspended tool. The suspension is streamed before
 * the suspended loop snapshot is persisted; resuming in that window used to dispatch a fresh
 * run with the resume payload as input and crash with
 * `Cannot read properties of undefined (reading 'threadId')`.
 */
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-resume-it2-serve-${Date.now()}.db`)).href;

function toolCallChunks(id: string, toolName: string, input: object) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId: `call-${id}`, toolName, input: JSON.stringify(input), providerExecuted: false },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
  ];
}

/** Iteration 1 calls lookup, iteration 2 calls request-approval, later calls answer with text. */
function mockModel(): any {
  let call = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream() {
      call++;
      const chunks =
        call === 1
          ? toolCallChunks('0', 'lookup', { orderId: '123' })
          : call === 2
            ? toolCallChunks('1', 'request-approval', { action: 'cancel' })
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-2', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'text-start', id: 't1' },
                { type: 'text-delta', id: 't1', delta: 'Done.' },
                { type: 'text-end', id: 't1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
              ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

async function drain(stream: AsyncIterable<any>, timeoutMs: number, stopOnSuspension = true) {
  const types: string[] = [];
  const errors: unknown[] = [];
  await Promise.race([
    (async () => {
      try {
        for await (const chunk of stream) {
          types.push(chunk?.type);
          if (chunk?.type === 'error') errors.push(chunk.payload?.error ?? chunk);
          if (
            chunk?.type === 'finish' ||
            (stopOnSuspension && (chunk?.type === 'tool-call-suspended' || chunk?.type === 'tool-call-approval'))
          )
            return;
        }
      } catch (e) {
        errors.push(e);
      }
    })(),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
  return { types, errors };
}

describe('durable agent resume after a suspend in a later loop iteration (#24749)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('resumes a tool that suspended in iteration 2 immediately after the suspension is streamed', async () => {
    const agentId = `resume-it2-${Date.now()}`;
    const threadId = `thread-${agentId}`;
    const resourceId = `resource-${agentId}`;
    const approvals: boolean[] = [];

    const lookup = createTool({
      id: 'lookup',
      description: 'Look up an order by id',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => ({ orderId, status: 'shipped' }),
    });
    const approval = createTool({
      id: 'request-approval',
      description: 'Ask a human to approve the action',
      inputSchema: z.object({ action: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ action }, context: any) => {
        if (!context?.agent?.resumeData) {
          return context.agent.suspend({ action });
        }
        approvals.push(context.agent.resumeData.approved);
        return { approved: context.agent.resumeData.approved };
      },
    });

    const storage = new DefaultStorage({ id: `resume-it2-${agentId}`, url: dbUrl });
    const agent = new Agent({
      id: agentId,
      name: 'Resume Iteration 2 Agent',
      instructions: 'Call lookup, then request-approval, then answer.',
      model: mockModel(),
      tools: { lookup, 'request-approval': approval },
      memory: new Memory({ storage }),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const first = await inngestAgent.stream([{ role: 'user', content: 'Cancel order 123' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    const firstResult = await drain(first.output.fullStream, 60_000);
    first.cleanup();
    expect(firstResult.types).toContain('tool-call-suspended');

    const resumed = await inngestAgent.resume(first.runId, { approved: true });
    const resumedResult = await drain(resumed.output.fullStream, 60_000, false);
    resumed.cleanup();

    expect(resumedResult.errors).toEqual([]);
    expect(resumedResult.types).toContain('finish');
    await vi.waitFor(() => expect(approvals).toEqual([true]), { timeout: 30_000, interval: 250 });
  });

  it('resumes repeated later-iteration suspensions in one run', async () => {
    const agentId = `resume-multi-${Date.now()}`;
    const threadId = `thread-${agentId}`;
    const resourceId = `resource-${agentId}`;
    const lookups: string[] = [];
    const executions: Array<{ action: string; approved: boolean }> = [];
    // Unique tool ids: resumed tool calls fall back to the Mastra-wide tool registry by id, which
    // would otherwise resolve the previous test's same-named tools (#24795).
    const lookupId = `lookup-${agentId}`;
    const approvalId = `request-approval-${agentId}`;

    // lookup -> approval(cancel) -> lookup -> approval(refund) -> text
    const script = [
      toolCallChunks('0', lookupId, { orderId: '123' }),
      toolCallChunks('1', approvalId, { action: 'cancel' }),
      toolCallChunks('2', lookupId, { orderId: '456' }),
      toolCallChunks('3', approvalId, { action: 'refund' }),
    ];
    let call = 0;
    const model: any = {
      specificationVersion: 'v2',
      provider: 'mock',
      modelId: 'mock-model',
      supportedUrls: {},
      async doStream() {
        const chunks = script[call++] ?? [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-final', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'All done.' },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        ];
        return {
          stream: simulateReadableStream({ chunks: chunks as any }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    };

    const lookup = createTool({
      id: lookupId,
      description: 'Look up an order by id',
      inputSchema: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        lookups.push(orderId);
        return { orderId, status: 'shipped' };
      },
    });
    const approval = createTool({
      id: approvalId,
      description: 'Ask a human to approve the action',
      inputSchema: z.object({ action: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ action }, context: any) => {
        if (!context?.agent?.resumeData) {
          return context.agent.suspend({ action });
        }
        executions.push({ action, approved: context.agent.resumeData.approved });
        return { approved: context.agent.resumeData.approved };
      },
    });

    const storage = new DefaultStorage({ id: `resume-multi-${agentId}`, url: dbUrl });
    const agent = new Agent({
      id: agentId,
      name: 'Resume Multi Agent',
      instructions: 'Follow the scripted tool calls.',
      model,
      tools: { [lookupId]: lookup, [approvalId]: approval },
      memory: new Memory({ storage }),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const first = await inngestAgent.stream([{ role: 'user', content: 'Cancel 123 and refund 456' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    const firstResult = await drain(first.output.fullStream, 60_000);
    first.cleanup();
    expect(firstResult.errors).toEqual([]);
    expect(firstResult.types).toContain('tool-call-suspended');

    // Resume immediately; the run must continue into a second suspension (iteration 4).
    const second = await inngestAgent.resume(first.runId, { approved: true });
    const secondResult = await drain(second.output.fullStream, 60_000);
    second.cleanup();
    expect(secondResult.errors).toEqual([]);
    expect(secondResult.types).toContain('tool-call-suspended');
    expect(secondResult.types).not.toContain('finish');

    // Resume the second suspension immediately with a denial.
    const third = await inngestAgent.resume(first.runId, { approved: false });
    const thirdResult = await drain(third.output.fullStream, 60_000, false);
    third.cleanup();
    expect(thirdResult.errors).toEqual([]);
    expect(thirdResult.types).toContain('finish');

    // Each suspended tool ran exactly once with its own resume data; nothing re-ran from scratch.
    await vi.waitFor(
      () =>
        expect(executions).toEqual([
          { action: 'cancel', approved: true },
          { action: 'refund', approved: false },
        ]),
      { timeout: 30_000, interval: 250 },
    );
    expect(lookups).toEqual(['123', '456']);
  });

  // #25158: one turn with two approval-gated tool calls runs them sequentially, so resuming the
  // first suspends the run again on the second. The second approval chunk is streamed before the
  // new suspended snapshot is persisted, so resuming it right away by its own toolCallId must wait
  // for its label instead of failing against the previous suspension's stale labels.
  it('resumes the second sequential approval in one turn by its own toolCallId', async () => {
    const agentId = `resume-seq-approval-${Date.now()}`;
    const toolId = `echo-${agentId}`;
    const executions: string[] = [];

    let call = 0;
    const model: any = {
      specificationVersion: 'v2',
      provider: 'mock',
      modelId: 'mock-model',
      supportedUrls: {},
      async doStream() {
        const chunks =
          call++ === 0
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'tool-call', toolCallId: 'call-a', toolName: toolId, input: '{"value":"a"}' },
                { type: 'tool-call', toolCallId: 'call-b', toolName: toolId, input: '{"value":"b"}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-final', modelId: 'mock-model', timestamp: new Date(0) },
                { type: 'text-start', id: 't1' },
                { type: 'text-delta', id: 't1', delta: 'Both done.' },
                { type: 'text-end', id: 't1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
              ];
        return {
          stream: simulateReadableStream({ chunks: chunks as any }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    };

    const echo = createTool({
      id: toolId,
      description: 'Approval-gated echo tool',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async ({ value }) => {
        executions.push(value);
        return { value };
      },
    });

    const agent = new Agent({
      id: agentId,
      name: 'Sequential Approval Agent',
      instructions: 'Echo each value.',
      model,
      tools: { [toolId]: echo },
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const loadLoopResumeLabels = async (runId: string) => {
      const workflowsStore = await getSharedMastra().getStorage()?.getStore('workflows');
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: InngestDurableStepIds.AGENTIC_LOOP,
        runId,
      });
      return Object.keys(snapshot?.resumeLabels ?? {});
    };

    const first = await inngestAgent.stream([{ role: 'user', content: 'Echo a and b' }], {
      closeOnSuspend: true,
    });
    const firstResult = await drain(first.output.fullStream, 60_000);
    first.cleanup();
    expect(firstResult.errors).toEqual([]);
    expect(firstResult.types).toContain('tool-call-approval');
    await vi.waitFor(async () => expect(await loadLoopResumeLabels(first.runId)).toEqual(['call-a']), {
      timeout: 30_000,
      interval: 250,
    });

    const second = await inngestAgent.resume(
      first.runId,
      { approved: true },
      { toolCallId: 'call-a', closeOnSuspend: true },
    );
    const secondResult = await drain(second.output.fullStream, 60_000);
    second.cleanup();
    expect(secondResult.errors).toEqual([]);
    expect(secondResult.types).toContain('tool-call-approval');
    expect(secondResult.types).not.toContain('finish');
    expect(executions).toEqual(['a']);

    // Resume the second approval immediately after its chunk is streamed, like an
    // HTTP client would, without waiting for the re-suspended snapshot to land.
    const third = await inngestAgent.resume(
      first.runId,
      { approved: true },
      { toolCallId: 'call-b', closeOnSuspend: true },
    );
    const thirdResult = await drain(third.output.fullStream, 60_000, false);
    third.cleanup();
    expect(thirdResult.errors).toEqual([]);
    expect(thirdResult.types).toContain('finish');
    await vi.waitFor(() => expect(executions).toEqual(['a', 'b']), { timeout: 30_000, interval: 250 });
  });
});
