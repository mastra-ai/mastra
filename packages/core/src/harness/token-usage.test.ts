import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness(storage = new InMemoryStore()) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

/**
 * Creates a mock async iterable simulating a fullStream with a step-finish chunk
 * containing the given usage data, followed by a finish chunk.
 */
async function* mockStream(usage: Record<string, unknown>) {
  yield {
    type: 'step-finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      output: { usage },
      stepResult: { reason: 'stop' },
      metadata: {},
    },
  };
  yield {
    type: 'finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      stepResult: { reason: 'stop' },
      output: { usage },
      metadata: {},
    },
  };
}

describe('step-finish token usage extraction', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('extracts token usage from AI SDK v5/v6 format (inputTokens/outputTokens)', async () => {
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = harness.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(100);
    expect(tokenUsage.completionTokens).toBe(50);
    expect(tokenUsage.totalTokens).toBe(150);
  });

  it('extracts token usage from legacy v4 format (promptTokens/completionTokens)', async () => {
    const usage = { promptTokens: 200, completionTokens: 80, totalTokens: 280 };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = harness.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(200);
    expect(tokenUsage.completionTokens).toBe(80);
    expect(tokenUsage.totalTokens).toBe(280);
  });

  it('preserves provider totalTokens and richer usage fields', async () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };
    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    const expectedUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };
    expect(harness.getTokenUsage()).toEqual(expectedUsage);
    expect(harness.getDisplayState().tokenUsage).toEqual(expectedUsage);
    expect(events.find(event => event.type === 'usage_update')).toEqual({
      type: 'usage_update',
      usage: expectedUsage,
    });
  });

  it('normalizes AI SDK nested output token details', async () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      outputTokenDetails: { reasoningTokens: 30 },
    };
    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    const expectedUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: 30,
      raw: usage,
    };
    expect(harness.getTokenUsage()).toEqual(expectedUsage);
    expect(harness.getDisplayState().tokenUsage).toEqual(expectedUsage);
    expect(events.find(event => event.type === 'usage_update')).toEqual({
      type: 'usage_update',
      usage: expectedUsage,
    });
  });

  it('normalizes OpenAI-style snake_case usage details', async () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 25 },
      completion_tokens_details: { reasoning_tokens: 30 },
    };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    expect(harness.getTokenUsage()).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: 30,
      cachedInputTokens: 25,
      raw: usage,
    });
  });

  it('normalizes Gemini-style usageMetadata fields', async () => {
    const usage = {
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 30,
        totalTokenCount: 180,
      },
    };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    expect(harness.getTokenUsage()).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 180,
      reasoningTokens: 30,
      raw: usage,
    });
  });

  it('normalizes nested v3 usage with cache counters', async () => {
    const usage = {
      inputTokens: {
        total: 100,
        cacheRead: 25,
        cacheWrite: 5,
      },
      outputTokens: {
        total: 50,
        reasoning: 30,
      },
    };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    expect(harness.getTokenUsage()).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: 30,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: usage,
    });
  });

  it('persists richer token usage in thread metadata', async () => {
    const storage = new InMemoryStore();
    harness = createHarness(storage);
    await harness.init();
    const thread = await harness.createThread();
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };

    await (harness as any).processStream({ fullStream: mockStream(usage) });

    await expect
      .poll(async () => {
        const memory = await storage.getStore('memory');
        const savedThread = await memory?.getThreadById({ threadId: thread.id });
        return savedThread?.metadata?.tokenUsage;
      })
      .toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 220,
        reasoningTokens: 70,
        cachedInputTokens: 25,
        cacheCreationInputTokens: 5,
        raw: { provider: 'test-provider' },
      });
  });

  it('accumulates token usage across multiple step-finish chunks', async () => {
    const usage1 = { inputTokens: 100, outputTokens: 50 };
    const usage2 = { inputTokens: 150, outputTokens: 70 };

    async function* multiStepStream() {
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage1 },
          stepResult: { reason: 'tool-calls' },
          metadata: {},
        },
      };
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage2 },
          stepResult: { reason: 'stop' },
          metadata: {},
        },
      };
      yield {
        type: 'finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: usage2 },
          metadata: {},
        },
      };
    }

    await (harness as any).processStream({ fullStream: multiStepStream() });

    const tokenUsage = harness.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(250);
    expect(tokenUsage.completionTokens).toBe(120);
    expect(tokenUsage.totalTokens).toBe(370);
  });

  it('accumulates richer usage fields across multiple step-finish chunks', async () => {
    const usage1 = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 180,
      reasoningTokens: 30,
      cachedInputTokens: 10,
      raw: { step: 1 },
    };
    const usage2 = {
      inputTokens: 150,
      outputTokens: 70,
      totalTokens: 260,
      reasoningTokens: 40,
      cacheCreationInputTokens: 12,
      raw: { step: 2 },
    };

    async function* multiStepStream() {
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage1 },
          stepResult: { reason: 'tool-calls' },
          metadata: {},
        },
      };
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage2 },
          stepResult: { reason: 'stop' },
          metadata: {},
        },
      };
      yield {
        type: 'finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: usage2 },
          metadata: {},
        },
      };
    }

    await (harness as any).processStream({ fullStream: multiStepStream() });

    expect(harness.getTokenUsage()).toEqual({
      promptTokens: 250,
      completionTokens: 120,
      totalTokens: 440,
      reasoningTokens: 70,
      cachedInputTokens: 10,
      cacheCreationInputTokens: 12,
      raw: { step: 2 },
    });
  });
});
