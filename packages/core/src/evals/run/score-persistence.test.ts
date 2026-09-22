import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
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
    }).generateScore(() => {
      // Simple scorer that always returns 0.85
      return 0.85;
    });

    // Use a real in-memory store rather than a partial mock: the agent loop
    // runs on the evented workflow engine, which needs a functioning
    // `workflows` store to coordinate step execution. A scores-only mock would
    // leave the loop unable to complete and the run would hang.
    const storage = new InMemoryStore();

    const mastra = new Mastra({
      agents: { testAgent: agent },
      scorers: { testScorer: scorer },
      logger: false,
      storage,
    });

    // Track saveScore calls by spying on the real scores store the eval
    // pipeline writes to, while still delegating to the real implementation.
    const saveScoreCalls: any[] = [];
    const scoresStore = (await mastra.getStorage()!.getStore('scores'))!;
    const realSaveScore = scoresStore.saveScore.bind(scoresStore);
    vi.spyOn(scoresStore, 'saveScore').mockImplementation(async (payload: any) => {
      saveScoreCalls.push(payload);
      return realSaveScore(payload);
    });

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

  it('persists a JSON-safe requestContext that excludes the auth token and non-serializable values', async () => {
    // Regression for #24664: the experiment score-save path previously wrote the
    // live RequestContext via `Object.fromEntries(entries())`, leaking
    // `mastra__authToken` (and other secrets) into score rows and stuffing in
    // non-serializable values that storage cannot round-trip. The persisted
    // snapshot must now go through toJSON() and drop the framework token,
    // matching the live-hook path and #21996.
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

    const scorer = createScorer({
      id: 'testScorer',
      description: 'Test scorer',
      name: 'testScorer',
    }).generateScore(() => 0.85);

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { testAgent: agent },
      scorers: { testScorer: scorer },
      logger: false,
      storage,
    });

    const saveScoreCalls: any[] = [];
    const scoresStore = (await mastra.getStorage()!.getStore('scores'))!;
    const realSaveScore = scoresStore.saveScore.bind(scoresStore);
    vi.spyOn(scoresStore, 'saveScore').mockImplementation(async (payload: any) => {
      saveScoreCalls.push(payload);
      return realSaveScore(payload);
    });

    // A request context carrying: a benign primitive (must survive), the
    // framework bearer token (must be omitted), and a non-serializable value
    // (a function — must be dropped by toJSON()).
    const requestContext = new RequestContext<Record<string, any>>([
      ['userId', 'u1'],
      [MASTRA_AUTH_TOKEN_KEY, 'super-secret-bearer-token'],
      ['onEvent', () => 'not serializable'],
    ]);

    await runEvals({
      data: [{ input: 'Test input', groundTruth: 'Expected output', requestContext }],
      scorers: [scorer],
      target: agent,
    });

    expect(saveScoreCalls.length).toBe(1);
    const persisted = saveScoreCalls[0].requestContext;
    // Benign primitive survives; token and function are gone.
    expect(persisted).toEqual({ userId: 'u1' });
    expect(persisted).not.toHaveProperty(MASTRA_AUTH_TOKEN_KEY);
    expect(persisted).not.toHaveProperty('onEvent');
    expect(JSON.stringify(persisted)).not.toContain('super-secret-bearer-token');
  });
});
