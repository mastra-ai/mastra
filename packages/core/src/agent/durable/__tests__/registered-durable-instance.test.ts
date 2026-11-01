/**
 * Regression tests for issue #28189: after `new Agent({ durable: true })` is
 * registered on Mastra, calls on the instance the user created must run
 * through the registered DurableAgent wrapper, not the plain agentic loop.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { DurableAgent } from '../durable-agent';
import { globalRunRegistry } from '../run-registry';

function textChunks(text: string) {
  return [
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'id-text', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start' as const, id: 'text-1' },
    { type: 'text-delta' as const, id: 'text-1', delta: text },
    { type: 'text-end' as const, id: 'text-1' },
    {
      type: 'finish' as const,
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    },
  ];
}

function toolCallChunks() {
  return [
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'id-tool', modelId: 'mock-model-id', timestamp: new Date(0) },
    {
      type: 'tool-call' as const,
      toolCallType: 'function' as const,
      toolCallId: 'call-1',
      toolName: 'approvalTool',
      input: JSON.stringify({ action: 'delete' }),
      providerExecuted: false,
    },
    {
      type: 'finish' as const,
      finishReason: 'tool-calls' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    },
  ];
}

function createSuspendingAgent(id: string) {
  const sideEffects: string[] = [];
  const approvalTool = createTool({
    id: 'approvalTool',
    description: 'Wait for approval',
    inputSchema: z.object({ action: z.string() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (input, context) => {
      if (!context?.agent?.resumeData) {
        return context?.agent?.suspend?.({ reason: `Approve ${input.action}?` });
      }
      sideEffects.push(input.action);
      return { completed: true };
    },
  });
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => ({
      stream: convertArrayToReadableStream(
        JSON.stringify(prompt).includes('"type":"tool-result"') ? textChunks('Resumed') : toolCallChunks(),
      ),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
  const agent = new Agent({
    id,
    name: id,
    instructions: 'Use the tool, then answer.',
    model: model as LanguageModelV2,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    tools: { approvalTool },
    durable: true,
  });
  return { agent, sideEffects };
}

async function collectText(stream: AsyncIterable<any>) {
  const text: string[] = [];
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text.push(chunk.payload.text);
  }
  return text.join('');
}

describe('registered `new Agent({ durable: true })` (issue #28189)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
  });

  it('runs the original reference through the durable loop and resumes it', async () => {
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const memory = { thread: 'registered-thread', resource: 'registered-resource' };
    const { agent, sideEffects } = createSuspendingAgent('registered-durable-agent');
    const mastra = new Mastra({ agents: { registeredDurable: agent }, storage, logger: false });
    const wrapper = mastra.getAgent('registeredDurable') as unknown as DurableAgent;

    const streamSpy = vi.spyOn(DurableAgent.prototype, 'stream');
    const started = await agent.stream('Delete the file', { memory, closeOnSuspend: true });
    for await (const _chunk of started.fullStream) void _chunk;

    expect(streamSpy).toHaveBeenCalledTimes(1);
    expect(streamSpy.mock.contexts[0]).toBe(wrapper);

    const persisted = await workflows.getWorkflowRunById({
      runId: started.runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
    expect(snapshot?.status).toBe('suspended');
    expect(sideEffects).toEqual([]);

    started.cleanup?.();
    const resumed = await agent.resumeStream(
      { approved: true },
      { runId: started.runId, toolCallId: 'call-1', memory },
    );
    expect(await collectText(resumed.fullStream)).toContain('Resumed');
    expect(sideEffects).toEqual(['delete']);
  });

  it('supports the durable-only `resume()` on the original reference', async () => {
    const storage = new InMemoryStore();
    const memory = { thread: 'resume-thread', resource: 'resume-resource' };
    const { agent, sideEffects } = createSuspendingAgent('registered-resume-agent');
    new Mastra({ agents: { registeredResume: agent }, storage, logger: false });

    const started = await agent.stream('Delete the file', { memory, closeOnSuspend: true });
    for await (const _chunk of started.fullStream) void _chunk;

    const resumed = await (agent as any).resume(started.runId, { approved: true }, { memory });
    expect(await collectText(resumed.fullStream)).toContain('Resumed');
    expect(sideEffects).toEqual(['delete']);
    resumed.cleanup();
  });
});
