import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { createScorer } from '../base';
import { runEvals } from '.';

describe('runEvals - Score Persistence', () => {
  it('automatically saves scores to storage when Mastra instance is available', async () => {
    // Create a simple agent
    const dummyModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Test response' }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Test' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'testAgent',
      name: 'Test Agent',
      instructions: 'Test instructions',
      model: dummyModel,
    });

    // Create a scorer
    const scorer = createScorer({
      id: 'testScorer',
      description: 'Test scorer for bug demonstration',
      name: 'testScorer',
    }).generateScore(({}) => {
      // Simple scorer that always returns 0.85
      return 0.85;
    });

    // Track if saveScore is called
    const saveScoreCalls: any[] = [];

    // Mock storage that tracks saveScore calls
    const mockStorage = {
      init: vi.fn().mockResolvedValue(undefined),
      getStore: vi.fn(async (storeName: string) => {
        if (storeName === 'scores') {
          return {
            saveScore: vi.fn(async (payload: any) => {
              saveScoreCalls.push(payload);
              return { score: { id: 'mock-id', ...payload } };
            }),
          };
        }
        // Return minimal mocks for other stores
        return null;
      }),
      __setLogger: vi.fn(),
    };

    const mastra = new Mastra({
      agents: { testAgent: agent },
      scorers: { testScorer: scorer },
      logger: false,
    });

    mastra.setStorage(mockStorage as any);

    // Run the evaluation
    const result = await runEvals({
      data: [
        { input: 'Test input 1', groundTruth: 'Expected output 1' },
        { input: 'Test input 2', groundTruth: 'Expected output 2' },
      ],
      scorers: [scorer],
      target: agent,
    });

    // Verify the scores were calculated correctly
    expect(result.scores.testScorer).toBe(0.85);
    expect(result.summary.totalItems).toBe(2);

    // Verify saveScore was called twice (once per data item)
    console.log('Number of times saveScore was called:', saveScoreCalls.length);
    console.log('Save score calls:', saveScoreCalls);

    // Scores should be automatically saved to storage
    expect(saveScoreCalls.length).toBe(2);

    // Verify first score includes groundTruth in additionalContext
    expect(saveScoreCalls[0]).toMatchObject({
      scorerId: 'testScorer',
      score: 0.85,
      source: 'TEST',
      entityId: 'testAgent',
      entityType: 'AGENT',
      additionalContext: {
        groundTruth: 'Expected output 1',
      },
    });

    // Verify second score includes its groundTruth
    expect(saveScoreCalls[1]).toMatchObject({
      scorerId: 'testScorer',
      score: 0.85,
      source: 'TEST',
      entityId: 'testAgent',
      entityType: 'AGENT',
      additionalContext: {
        groundTruth: 'Expected output 2',
      },
    });
  });
});
