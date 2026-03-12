import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createHarness() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
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
});
