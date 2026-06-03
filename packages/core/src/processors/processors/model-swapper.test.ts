import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import type { ModelSwapperResult } from './model-swapper';
import { ModelSwapperProcessor } from './model-swapper';

function createTestMessage(text: string, id = 'test-id'): MastraDBMessage {
  return {
    id,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function createNonTextMessage(): MastraDBMessage {
  return {
    id: 'non-text',
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'file', mimeType: 'image/png', data: 'abc' }],
    },
    createdAt: new Date(),
  } as MastraDBMessage;
}

function setupMockModel(
  result: Pick<ModelSwapperResult, 'ruleName' | 'category' | 'confidence' | 'reason'>,
): MockLanguageModelV1 {
  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: JSON.stringify(result),
    }),
  });
}

function createProcessor(
  result: Pick<ModelSwapperResult, 'ruleName' | 'category' | 'confidence' | 'reason'>,
  options = {},
) {
  return new ModelSwapperProcessor({
    model: setupMockModel(result),
    rules: [
      {
        name: 'simple',
        description: 'Simple factual questions',
        model: 'simple-model',
      },
      {
        name: 'complex',
        description: 'Complex reasoning and planning',
        model: 'complex-model',
      },
    ],
    ...options,
  });
}

async function runInput(
  processor: ModelSwapperProcessor,
  messages: MastraDBMessage[],
  state: Record<string, unknown> = {},
) {
  return processor.processInput({
    messages,
    state,
    abort: vi.fn() as any,
    retryCount: 0,
    systemMessages: [],
  } as any);
}

describe('ModelSwapperProcessor', () => {
  it('selects a matched rule model for the first step', async () => {
    const processor = createProcessor({
      ruleName: 'complex',
      category: 'reasoning',
      confidence: 0.92,
      reason: 'The request asks for a multi-step plan.',
    });
    const messages = [createTestMessage('Create a detailed migration plan')];
    const state = {};

    const result = await runInput(processor, messages, state);
    const stepResult = processor.processInputStep({ stepNumber: 0, state } as any);

    expect(result).toBe(messages);
    expect(stepResult).toEqual({ model: 'complex-model' });
  });

  it('leaves the model unchanged when no rule matches and no fallback is configured', async () => {
    const processor = createProcessor({
      ruleName: null,
      category: null,
      confidence: 0.2,
      reason: 'No route applies.',
    });
    const state = {};

    await runInput(processor, [createTestMessage('Hello')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({});
  });

  it('uses the fallback model when no rule matches', async () => {
    const processor = createProcessor(
      {
        ruleName: 'NO_MATCH',
        category: null,
        confidence: 0.1,
        reason: 'No route applies.',
      },
      { fallbackModel: 'fallback-model' },
    );
    const state = {};

    await runInput(processor, [createTestMessage('Hello')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({ model: 'fallback-model' });
  });

  it('uses the default model when a match is below threshold', async () => {
    const processor = createProcessor(
      {
        ruleName: 'complex',
        category: 'reasoning',
        confidence: 0.4,
        reason: 'Weak match.',
      },
      { threshold: 0.8, defaultModel: 'default-model' },
    );
    const state = {};

    await runInput(processor, [createTestMessage('Maybe do something harder')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({ model: 'default-model' });
  });

  it('does not swap for empty or non-text messages', async () => {
    const processor = createProcessor({
      ruleName: 'simple',
      category: 'facts',
      confidence: 0.95,
      reason: 'Simple question.',
    });
    const state = {};

    const result = await runInput(processor, [createNonTextMessage()], state);

    expect(result[0].id).toBe('non-text');
    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({});
  });

  it('does not reapply the selected model after the first step', async () => {
    const processor = createProcessor({
      ruleName: 'simple',
      category: 'facts',
      confidence: 0.95,
      reason: 'Simple question.',
    });
    const state = {};

    await runInput(processor, [createTestMessage('What is 2+2?')], state);

    expect(processor.processInputStep({ stepNumber: 1, state } as any)).toEqual({});
  });
});
