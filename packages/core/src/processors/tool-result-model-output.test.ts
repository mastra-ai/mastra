import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';

// A tool with toModelOutput must have its mapper applied to the value a
// processToolResult processor rewrote, not the raw tool return. Otherwise the
// model sees the raw value (for example a secret a redactor removed).

function recordingModel(prompts: unknown[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const toolTurn = prompts.length === 1;
      return {
        stream: convertArrayToReadableStream(
          (toolTurn
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r1', modelId: 'mock', timestamp: new Date(0) },
                { type: 'tool-call', toolCallId: 'tc-1', toolName: 'getSecret', input: '{"q":"x"}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r2', modelId: 'mock', timestamp: new Date(0) },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'ok' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ]) as any[],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

const secretTool = () =>
  createTool({
    id: 'getSecret',
    description: 'Get secret',
    inputSchema: z.object({ q: z.string() }),
    execute: async () => 'SECRET-TOKEN body',
    toModelOutput: (output: unknown) => ({ type: 'text' as const, value: `mapped: ${String(output)}` }),
  });

const redactor = {
  id: 'redactor',
  async processToolResult({ messageList, toolCallId, toolName, args }: any) {
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args, result: '[REDACTED]' },
    });
  },
};

const MCP_CONTENT = Symbol.for('mastra.mcp.callToolContent');

// Returns an object result carrying an MCP-style symbol, mutates it in place in
// the processor, and records what the mapper saw.
function inPlaceSetup() {
  const seen: unknown[] = [];
  const tool = createTool({
    id: 'getSecret',
    description: 'Get secret',
    inputSchema: z.object({ q: z.string() }),
    execute: async () => {
      const out: Record<PropertyKey, unknown> = { secret: 'SECRET-TOKEN' };
      out[MCP_CONTENT] = [{ type: 'text', text: 'mcp' }];
      return out;
    },
    toModelOutput: (output: any) => {
      seen.push(output);
      return { type: 'text' as const, value: `mapped: ${output.secret} symbol:${output[MCP_CONTENT] ? 'yes' : 'no'}` };
    },
  });
  const mutator = {
    id: 'mutator',
    async processToolResult({ messageList, toolCallId, toolName, args, result }: any) {
      result.secret = '[REDACTED]';
      messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId, toolName, args, result },
      });
    },
  };
  return { tool, mutator, seen };
}

function secondPrompt(prompts: unknown[]) {
  expect(prompts).toHaveLength(2);
  return JSON.stringify(prompts[1]);
}

describe('toModelOutput after processToolResult', () => {
  let pubsub: EventEmitterPubSub;
  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });
  afterEach(async () => {
    await pubsub.close();
  });

  it('default engine maps the processor-rewritten result', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'mo-default',
      name: 'mo-default',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: secretTool() },
      outputProcessors: [redactor as any],
    });
    const stream = await agent.stream('go', { maxSteps: 3 });
    for await (const _ of stream.fullStream) void _;

    const prompt = secondPrompt(prompts);
    expect(prompt).toContain('mapped: [REDACTED]');
    expect(prompt).not.toContain('SECRET-TOKEN');
  });

  it('default engine still maps the raw result when no processor rewrites it', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'mo-default-plain',
      name: 'mo-default-plain',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: secretTool() },
      outputProcessors: [{ id: 'noop', async processToolResult() {} } as any],
    });
    const stream = await agent.stream('go', { maxSteps: 3 });
    for await (const _ of stream.fullStream) void _;

    expect(secondPrompt(prompts)).toContain('mapped: SECRET-TOKEN body');
  });

  it('default engine remaps a result the processor mutated in place, keeping the original object', async () => {
    const prompts: unknown[] = [];
    const { tool, mutator, seen } = inPlaceSetup();
    const agent = new Agent({
      id: 'mo-inplace',
      name: 'mo-inplace',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: tool },
      outputProcessors: [mutator as any],
    });
    const stream = await agent.stream('go', { maxSteps: 3 });
    for await (const _ of stream.fullStream) void _;

    const prompt = secondPrompt(prompts);
    expect(prompt).toContain('mapped: [REDACTED] symbol:yes');
    expect(prompt).not.toContain('SECRET-TOKEN');
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it('default engine applies the transcript payload transform to the rewritten result', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'mo-transform',
      name: 'mo-transform',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: secretTool() },
      outputProcessors: [redactor as any],
    });
    const stream = await agent.stream('go', {
      maxSteps: 3,
      transform: {
        targets: ['display', 'transcript'],
        transformToolPayload: (ctx: any) => (ctx.phase === 'output-available' ? `T:${String(ctx.output)}` : ctx.input),
      },
    } as any);
    const chunks: any[] = [];
    for await (const c of stream.fullStream) chunks.push(c);

    const meta = chunks.find(c => c.type === 'tool-result')?.metadata?.mastra?.toolPayloadTransform;
    expect(meta?.transcript?.['output-available']?.transformed).toBe('T:[REDACTED]');
    expect(meta?.display?.['output-available']?.transformed).toBe('T:[REDACTED]');
  });

  it('durable engine maps the processor-rewritten result', async () => {
    const prompts: unknown[] = [];
    const baseAgent = new Agent({
      id: 'mo-durable',
      name: 'mo-durable',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: secretTool() },
      outputProcessors: [redactor as any],
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ agents: { 'mo-durable': durableAgent as any }, logger: false, storage: new InMemoryStore(), pubsub });
    const result = await durableAgent.stream('go', { maxSteps: 3 });
    for await (const _ of result.fullStream) void _;

    const prompt = secondPrompt(prompts);
    expect(prompt).toContain('mapped: [REDACTED]');
    expect(prompt).not.toContain('SECRET-TOKEN');
  });

  it('durable engine remaps a result the processor mutated in place', async () => {
    const prompts: unknown[] = [];
    const { tool, mutator } = inPlaceSetup();
    const baseAgent = new Agent({
      id: 'mo-durable-inplace',
      name: 'mo-durable-inplace',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: { getSecret: tool },
      outputProcessors: [mutator as any],
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'mo-durable-inplace': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durableAgent.stream('go', { maxSteps: 3 });
    for await (const _ of result.fullStream) void _;

    const prompt = secondPrompt(prompts);
    expect(prompt).toContain('mapped: [REDACTED] symbol:yes');
    expect(prompt).not.toContain('SECRET-TOKEN');
  });

  it('durable engine keeps the original mapping when no processor rewrites', async () => {
    const prompts: unknown[] = [];
    const mapper = vi.fn((output: unknown) => ({ type: 'text' as const, value: `mapped: ${String(output)}` }));
    const baseAgent = new Agent({
      id: 'mo-durable-plain',
      name: 'mo-durable-plain',
      instructions: 'x',
      model: recordingModel(prompts) as LanguageModelV2,
      tools: {
        getSecret: createTool({
          id: 'getSecret',
          description: 'Get secret',
          inputSchema: z.object({ q: z.string() }),
          execute: async () => 'SECRET-TOKEN body',
          toModelOutput: mapper,
        }),
      },
      outputProcessors: [{ id: 'noop', async processToolResult() {} } as any],
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'mo-durable-plain': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durableAgent.stream('go', { maxSteps: 3 });
    for await (const _ of result.fullStream) void _;

    expect(secondPrompt(prompts)).toContain('mapped: SECRET-TOKEN body');
    expect(mapper).toHaveBeenCalledTimes(1);
  });
});
