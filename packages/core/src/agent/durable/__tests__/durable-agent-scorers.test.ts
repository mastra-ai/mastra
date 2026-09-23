import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../../evals';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// DurableAgent Scorer Tests
// ============================================================================

describe('DurableAgent Scorers', () => {
  let pubsub: EventEmitterPubSub;
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();

    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'Hello' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('scorer configuration serialization', () => {
    it('should serialize scorers config in workflow input', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          testScorer: {
            scorer: testScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers).toHaveProperty('testScorer');
      expect(result.workflowInput.scorers!.testScorer!.scorerName).toBe('testScorer');
    });

    it('should serialize scorer sampling config', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          testScorer: {
            scorer: testScorer,
            sampling: { type: 'ratio', rate: 0.5 },
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers!.testScorer!.sampling).toEqual({
        type: 'ratio',
        rate: 0.5,
      });
    });

    it('should not include scorers in workflow input when not configured', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeUndefined();
    });
  });

  describe('scorer execution', () => {
    it('should allow override scorers in execution options', async () => {
      const defaultScorer = createScorer({
        id: 'default-scorer',
        name: 'defaultScorer',
        description: 'Default Scorer',
      }).generateScore(() => 0.8);

      const overrideScorer = createScorer({
        id: 'override-scorer',
        name: 'overrideScorer',
        description: 'Override Scorer',
      }).generateScore(() => 0.9);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          defaultScorer: {
            scorer: defaultScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // Override scorers in execution options
      const result = await durableAgent.prepare('Hello', {
        scorers: {
          overrideScorer: {
            scorer: overrideScorer,
          },
        },
      } as any);

      // Override should replace default scorers
      expect(result.workflowInput.scorers).toBeDefined();
      expect(result.workflowInput.scorers).toHaveProperty('overrideScorer');
      expect(result.workflowInput.scorers).not.toHaveProperty('defaultScorer');
    });
  });

  describe('scorer name resolution', () => {
    it('should serialize scorer by name for runtime resolution', async () => {
      const testScorer = createScorer({
        id: 'test-scorer',
        name: 'testScorer',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          myScorer: {
            scorer: testScorer,
          },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      // The scorer config should contain the name, not the object
      expect(result.workflowInput.scorers!.myScorer!.scorerName).toBe('testScorer');
    });

    it('should support multiple scorers', async () => {
      const scorer1 = createScorer({
        id: 'scorer-1',
        name: 'scorer1',
        description: 'First Scorer',
      }).generateScore(() => 0.8);

      const scorer2 = createScorer({
        id: 'scorer-2',
        name: 'scorer2',
        description: 'Second Scorer',
      }).generateScore(() => 0.9);

      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
        scorers: {
          first: { scorer: scorer1 },
          second: { scorer: scorer2, sampling: { type: 'none' } },
        },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.scorers).toBeDefined();
      expect(Object.keys(result.workflowInput.scorers!)).toHaveLength(2);
      expect(result.workflowInput.scorers!.first!.scorerName).toBe('scorer1');
      expect(result.workflowInput.scorers!.second!.scorerName).toBe('scorer2');
      expect(result.workflowInput.scorers!.second!.sampling).toEqual({ type: 'none' });
    });
  });

  describe('returnScorerData option', () => {
    it('should serialize returnScorerData option in workflow input', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        returnScorerData: true,
      });

      expect(result.workflowInput.options.returnScorerData).toBe(true);
    });

    it('should default returnScorerData to undefined when not specified', async () => {
      const baseAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.options.returnScorerData).toBeUndefined();
    });
  });
});

// ============================================================================
// scoringData propagation (issue #22743)
//
// Serializing `returnScorerData` into the workflow input (covered above) is
// not enough — the client-side stream adapter must also pass the flag into
// its MastraModelOutput, otherwise getFullOutput() silently omits
// `scoringData` and runEvals/startExperiment scorers evaluate
// `output: undefined`.
// ============================================================================

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent scoringData propagation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('returns scoringData from generate() when returnScorerData is true', async () => {
    const model = createTextModel('Durable scored response');
    const baseAgent = new Agent({
      id: 'scoring-data-generate-agent',
      name: 'Scoring Data Generate Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const out = await durableAgent.generate('score me', { returnScorerData: true });

    expect(out.text).toBe('Durable scored response');
    // Core regression for #22743: the flag must reach the durable stream
    // adapter's MastraModelOutput, not just the serialized workflow input.
    expect(out.scoringData).toBeDefined();
    expect(out.scoringData!.input).toMatchObject({
      inputMessages: expect.any(Array),
      rememberedMessages: expect.any(Array),
      systemMessages: expect.any(Array),
    });
    // The adapter's MessageList must actually contain this turn's messages —
    // a defined-but-hollow scoringData would still corrupt evals silently.
    expect(JSON.stringify(out.scoringData!.input.inputMessages)).toContain('score me');
    expect(out.scoringData!.output).toBeInstanceOf(Array);
    expect(JSON.stringify(out.scoringData!.output)).toContain('Durable scored response');
  });

  it('omits scoringData from generate() when returnScorerData is not set', async () => {
    const model = createTextModel('No scoring here');
    const baseAgent = new Agent({
      id: 'scoring-data-default-agent',
      name: 'Scoring Data Default Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const out = await durableAgent.generate('hi');

    expect(out.text).toBe('No scoring here');
    // Parity with non-durable Agent.generate(): off by default.
    expect(out.scoringData).toBeUndefined();
  });

  it('returns scoringData from stream() via getFullOutput() when returnScorerData is true', async () => {
    const model = createTextModel('Durable scored stream');
    const baseAgent = new Agent({
      id: 'scoring-data-stream-agent',
      name: 'Scoring Data Stream Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.stream('score me', { returnScorerData: true });
    try {
      const out = await result.output.getFullOutput();

      expect(out.text).toBe('Durable scored stream');
      expect(out.scoringData).toBeDefined();
      expect(JSON.stringify(out.scoringData!.output)).toContain('Durable scored stream');
    } finally {
      result.cleanup();
    }
  });

  it('retains scoringData across generate → suspend → resumeGenerate', async () => {
    const model = createToolCallThenTextModel('searchTool', { query: 'mastra' }, 'Found: mastra');
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });

    const baseAgent = new Agent({
      id: 'scoring-data-resume-agent',
      name: 'Scoring Data Resume Agent',
      instructions: 'Use the search tool when asked.',
      model: model as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra so the durable workflow has a storage backend
    // to persist the suspended snapshot resumeGenerate needs to re-enter.
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'scoring-data-resume-agent': durableAgent as any },
    });

    const first = await durableAgent.generate('search for mastra', {
      requireToolApproval: true,
      returnScorerData: true,
    });

    expect(first.finishReason).toBe('suspended');
    expect(first.runId).toBeDefined();

    const second = await durableAgent.resumeGenerate(first.runId!, { approved: true });

    expect(second.text).toBe('Found: mastra');
    expect(second.finishReason).toBe('stop');
    // returnScorerData was serialized into the persisted workflow input at
    // prepare time, so the resumed segment must honor it without re-passing.
    expect(second.scoringData).toBeDefined();
    expect(JSON.stringify(second.scoringData!.output)).toContain('Found: mastra');
  });

  it('run-level returnScorerData survives resume when agent defaultOptions disable it', async () => {
    const model = createToolCallThenTextModel('searchTool', { query: 'mastra' }, 'Found: mastra');
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });

    const baseAgent = new Agent({
      id: 'scoring-data-defaults-agent',
      name: 'Scoring Data Defaults Agent',
      instructions: 'Use the search tool when asked.',
      model: model as LanguageModelV2,
      tools: { searchTool },
      // Merged into resolvedOptions on resume — must NOT override the
      // run-level opt-in persisted at prepare time.
      defaultOptions: { returnScorerData: false },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'scoring-data-defaults-agent': durableAgent as any },
    });

    const first = await durableAgent.generate('search for mastra', {
      requireToolApproval: true,
      returnScorerData: true,
    });

    expect(first.finishReason).toBe('suspended');
    expect(first.scoringData).toBeDefined();

    const second = await durableAgent.resumeGenerate(first.runId!, { approved: true });

    expect(second.text).toBe('Found: mastra');
    expect(second.finishReason).toBe('stop');
    expect(second.scoringData).toBeDefined();
    expect(JSON.stringify(second.scoringData!.output)).toContain('Found: mastra');
  });
});
