import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
