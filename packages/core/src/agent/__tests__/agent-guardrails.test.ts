import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
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
});
