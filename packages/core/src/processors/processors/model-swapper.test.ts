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

function setupMockModel(result: Pick<ModelSwapperResult, 'rule'>): MockLanguageModelV1 {
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

function createProcessor(result: Pick<ModelSwapperResult, 'rule'>, options = {}) {
  return new ModelSwapperProcessor({
    model: setupMockModel(result),
    rules: [
      {
        description: 'Simple factual questions',
        model: 'simple-model',
      },
      {
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
    const processor = createProcessor({ rule: 2 });
    const messages = [createTestMessage('Create a detailed migration plan')];
    const state = {};

    const result = await runInput(processor, messages, state);
    const stepResult = processor.processInputStep({ stepNumber: 0, state } as any);

    expect(result).toBe(messages);
    expect(stepResult).toEqual({ model: 'complex-model' });
  });

  it('leaves the model unchanged when no rule matches and no default model is configured', async () => {
    const processor = createProcessor({ rule: 0 });
    const state = {};

    await runInput(processor, [createTestMessage('Hello')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({});
  });

  it('uses the default model when no rule matches', async () => {
    const processor = createProcessor({ rule: 0 }, { defaultModel: 'default-model' });
    const state = {};

    await runInput(processor, [createTestMessage('Hello')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({ model: 'default-model' });
  });

  it('uses the default model when the classifier returns an invalid rule number', async () => {
    const processor = createProcessor({ rule: 3 }, { defaultModel: 'default-model' });
    const state = {};

    await runInput(processor, [createTestMessage('Maybe do something harder')], state);

    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({ model: 'default-model' });
  });

  it('does not swap for empty or non-text messages', async () => {
    const processor = createProcessor({ rule: 1 });
    const state = {};

    const result = await runInput(processor, [createNonTextMessage()], state);

    expect(result[0].id).toBe('non-text');
    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({});
  });

  it('does not reapply the selected model after the first step', async () => {
    const processor = createProcessor({ rule: 1 });
    const state = {};

    await runInput(processor, [createTestMessage('What is 2+2?')], state);

    expect(processor.processInputStep({ stepNumber: 1, state } as any)).toEqual({});
  });
});
