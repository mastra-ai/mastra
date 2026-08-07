/**
 * DurableAgent function-form requireToolApproval tests
 *
 * Verifies that the per-call function policy is preserved in-process: the closure
 * lives on the run registry and is evaluated with the real (toolName, args) per
 * tool call. Cross-process engines fall back to the boolean shadow (true).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { delay } from '../../../utils';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import type { AgentStreamEvent } from '../types';

function createMultipleToolCallsModel(tools: Array<{ name: string; args: object }>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...tools.map((tool, index) => ({
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: `call-${index + 1}`,
          toolName: tool.name,
          input: JSON.stringify(tool.args),
          providerExecuted: false,
        })),
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function collectPubsubEvents(pubsub: EventEmitterPubSub, runId: string) {
  const events: AgentStreamEvent[] = [];
  pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
    events.push(event as unknown as AgentStreamEvent);
  });
  return events;
}

describe('DurableAgent function-form requireToolApproval', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stores function policy on the registry and serializes a `true` shadow into workflow input', async () => {
    const mockModel = createMultipleToolCallsModel([{ name: 'safeTool', args: { x: 1 } }]);
    const safeTool = createTool({
      id: 'safeTool',
      description: 'safe',
      inputSchema: z.object({ x: z.number() }),
      execute: async () => 'ok',
    });

    const baseAgent = new Agent({
      id: 'fn-policy-agent',
      name: 'Fn Policy Agent',
      instructions: 'tools',
      model: mockModel as LanguageModelV2,
      tools: { safeTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy = vi.fn().mockReturnValue(false);
    const prep = await durableAgent.prepare('Run safeTool', { requireToolApproval: policy });

    // Cross-process shadow is the safe default `true`.
    expect(prep.workflowInput.options.requireToolApproval).toBe(true);

    // In-process registry preserves the closure verbatim.
    const entry = globalRunRegistry.get(prep.runId);
    expect(entry?.requireToolApproval).toBe(policy);
  });

  it('evaluates function policy per tool call with real toolName/args', async () => {
    const mockModel = createMultipleToolCallsModel([
      { name: 'readTool', args: { id: 'safe-1' } },
      { name: 'writeTool', args: { id: 'danger-1' } },
    ]);

    const readTool = createTool({
      id: 'readTool',
      description: 'read',
      inputSchema: z.object({ id: z.string() }),
      execute: async () => 'read-ok',
    });
    const writeTool = createTool({
      id: 'writeTool',
      description: 'write',
      inputSchema: z.object({ id: z.string() }),
      execute: async () => 'write-ok',
    });

    const baseAgent = new Agent({
      id: 'per-call-agent',
      name: 'Per Call Agent',
      instructions: 'tools',
      model: mockModel as LanguageModelV2,
      tools: { readTool, writeTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Gate only `writeTool` — `readTool` should run without approval.
    const policy = vi.fn(({ toolName }: { toolName: string }) => toolName === 'writeTool');

    const prep = await durableAgent.prepare('Run both tools', { requireToolApproval: policy });
    const events = collectPubsubEvents(pubsub, prep.runId);

    const { cleanup } = await durableAgent.stream('Run both tools', {
      runId: prep.runId,
      requireToolApproval: policy,
    });

    // Let the workflow run far enough for the gate decisions to happen.
    await delay(600);

    // Policy must have been invoked for each tool call, with the actual args.
    expect(policy).toHaveBeenCalled();
    const callArgs = policy.mock.calls.map(args => args[0]);
    const calledNames = callArgs.map(ctx => ctx.toolName).sort();
    expect(calledNames).toEqual(['readTool', 'writeTool']);

    // Sanity: the args object was forwarded with the real values.
    const writeCall = callArgs.find(ctx => ctx.toolName === 'writeTool');
    expect(writeCall?.args).toEqual({ id: 'danger-1' });
    const readCall = callArgs.find(ctx => ctx.toolName === 'readTool');
    expect(readCall?.args).toEqual({ id: 'safe-1' });

    // Only writeTool should have triggered an approval chunk on pubsub.
    const approvalChunks = events.filter(
      e => e.type === AgentStreamEventTypes.CHUNK && (e as any).data?.type === 'tool-call-approval',
    );
    const approvalNames = approvalChunks.map(e => (e as any).data?.payload?.toolName);
    expect(approvalNames).toContain('writeTool');
    expect(approvalNames).not.toContain('readTool');

    cleanup();
  });

  it('defaults to "require approval" when the function policy throws (safe default)', async () => {
    const mockModel = createMultipleToolCallsModel([{ name: 'someTool', args: { ok: true } }]);
    const someTool = createTool({
      id: 'someTool',
      description: 'a tool',
      inputSchema: z.object({ ok: z.boolean() }),
      execute: async () => 'done',
    });

    const baseAgent = new Agent({
      id: 'throwing-policy-agent',
      name: 'Throwing Policy Agent',
      instructions: 'tools',
      model: mockModel as LanguageModelV2,
      tools: { someTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy = vi.fn(() => {
      throw new Error('boom');
    });

    const prep = await durableAgent.prepare('Run it', { requireToolApproval: policy });
    const events = collectPubsubEvents(pubsub, prep.runId);

    const { cleanup } = await durableAgent.stream('Run it', {
      runId: prep.runId,
      requireToolApproval: policy,
    });

    await delay(600);

    const approvalChunks = events.filter(
      e => e.type === AgentStreamEventTypes.CHUNK && (e as any).data?.type === 'tool-call-approval',
    );
    const approvalNames = approvalChunks.map(e => (e as any).data?.payload?.toolName);
    expect(approvalNames).toContain('someTool');

    cleanup();
  });
});
