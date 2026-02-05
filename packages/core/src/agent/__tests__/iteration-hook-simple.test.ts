import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

describe('onIterationComplete Basic Integration', () => {
  it('should accept onIterationComplete configuration without errors', async () => {
    const hookMock = vi.fn(() => ({ continue: true }));

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'Test agent',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Response',
          content: [{ type: 'text', text: 'Response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      }),
    });

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      storage: new InMemoryStore(),
      memory: new MockMemory(),
    });

    const testAgent = mastra.getAgent('test-agent');

    // This should not throw an error
    const result = await testAgent.generate('Test', {
      maxSteps: 1,
      onIterationComplete: hookMock,
    });

    expect(result).toBeDefined();
    expect(result.text).toBe('Response');

    // Hook should be called after the iteration
    expect(hookMock).toHaveBeenCalled();
  });
});
