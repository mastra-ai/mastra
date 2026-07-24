import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../processors';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { MessageList } from '../message-list';

const model = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    content: [],
    warnings: [],
  }),
});

const createMessage = (content: string, role: 'user' | 'assistant' = 'user') => ({
  id: `msg-${Math.random().toString(36).slice(2)}`,
  role,
  content: {
    format: 2 as const,
    parts: [{ type: 'text' as const, text: content }],
  },
  createdAt: new Date(),
  threadId: 'guardrails-test-thread',
});

describe('Agent guardrails', () => {
  it('runs configured guardrails through agent input processing', async () => {
    const agent = new Agent({
      id: 'guardrail-agent',
      name: 'Guardrail Agent',
      instructions: 'test',
      model,
      guardrails: {
        privacy: {
          secrets: { action: 'block', applyTo: 'input' },
        },
      },
    });
    const messageList = new MessageList({ threadId: 'guardrails-test-thread' });
    messageList.add([createMessage('api_key = abcdefghijklmnopqrstuvwxyz')], 'input');

    const result = await (agent as any).__runInputProcessors({
      requestContext: new RequestContext(),
      messageList,
    });

    expect(result.tripwire).toEqual(
      expect.objectContaining({
        reason: expect.stringContaining('Regex filter: blocked content matching patterns: api-key'),
      }),
    );
  });

  it('keeps input processors working when guardrails are present', async () => {
    const processInput = vi.fn(({ messages }) => messages);
    const inputProcessor: Processor = {
      id: 'custom-input-processor',
      processInput,
    };
    const agent = new Agent({
      id: 'guardrail-agent',
      name: 'Guardrail Agent',
      instructions: 'test',
      model,
      guardrails: {
        privacy: {
          secrets: { action: 'warn', applyTo: 'input' },
        },
      },
      inputProcessors: [inputProcessor as any],
    });
    const messageList = new MessageList({ threadId: 'guardrails-test-thread' });
    messageList.add([createMessage('hello')], 'input');

    const result = await (agent as any).__runInputProcessors({
      requestContext: new RequestContext(),
      messageList,
    });

    expect(result.tripwire).toBeUndefined();
    expect(processInput).toHaveBeenCalledTimes(1);
  });

  it('lets per-call guardrails replace agent-level guardrails', async () => {
    const agent = new Agent({
      id: 'guardrail-agent',
      name: 'Guardrail Agent',
      instructions: 'test',
      model,
      guardrails: {
        privacy: {
          secrets: { action: 'block', applyTo: 'input' },
        },
      },
    });
    const messageList = new MessageList({ threadId: 'guardrails-test-thread' });
    messageList.add([createMessage('api_key = abcdefghijklmnopqrstuvwxyz')], 'input');

    const result = await (agent as any).__runInputProcessors({
      requestContext: new RequestContext(),
      messageList,
      guardrailOverrides: false,
    });

    expect(result.tripwire).toBeUndefined();
  });

  it('runs output guardrails through agent output processing', async () => {
    const agent = new Agent({
      id: 'guardrail-agent',
      name: 'Guardrail Agent',
      instructions: 'test',
      model,
      guardrails: {
        privacy: {
          secrets: { action: 'block', applyTo: 'output' },
        },
      },
    });
    const messageList = new MessageList({ threadId: 'guardrails-test-thread' });
    messageList.add([createMessage('Bearer secret-token-value', 'assistant')], 'response');

    const result = await (agent as any).__runOutputProcessors({
      requestContext: new RequestContext(),
      messageList,
    });

    expect(result.tripwire).toEqual(
      expect.objectContaining({
        reason: expect.stringContaining('Regex filter: blocked content matching patterns: bearer-token'),
      }),
    );
  });

  it('applies per-call guardrails to legacy structured generate output', async () => {
    const agent = new Agent({
      id: 'legacy-structured-guardrail-agent',
      name: 'Legacy Structured Guardrail Agent',
      instructions: 'test',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1 },
          text: '{"message":"Bearer abcdefghijklmnopqrstuvwxyz"}',
        }),
      }),
    });

    const result = await agent.generateLegacy('test', {
      output: z.object({ message: z.string() }),
      guardrails: {
        privacy: { secrets: { action: 'block', applyTo: 'output' } },
      },
    });

    expect(result.tripwire).toEqual(
      expect.objectContaining({
        reason: expect.stringContaining('Regex filter: blocked content matching patterns: bearer-token'),
      }),
    );
  });

  it('applies per-call guardrails when legacy streamObject completes', async () => {
    const onViolation = vi.fn();
    const agent = new Agent({
      id: 'legacy-stream-object-guardrail-agent',
      name: 'Legacy Stream Object Guardrail Agent',
      instructions: 'test',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: '{"message":"Bearer abcdefghijklmnopqrstuvwxyz"}' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 1, completionTokens: 1 },
              },
            ],
          }),
        }),
      }),
    });

    const result = await agent.streamLegacy('test', {
      output: z.object({ message: z.string() }),
      guardrails: {
        privacy: { secrets: { action: 'block', applyTo: 'output' } },
        onViolation,
      },
    });

    for await (const _ of result.partialObjectStream) {
      // Consume the stream to trigger output processing.
    }
    expect(onViolation).toHaveBeenCalledWith(expect.objectContaining({ group: 'privacy', check: 'secrets' }));
  });
});
