/**
 * Tests for Agent Network Structured Output feature
 * GitHub Issue #11337: Add Structured Output to network result
 *
 * These tests verify the implementation of structured output
 * support in agent.network() method.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import type { NetworkOptions } from '../agent.types';

describe('Agent Network - Structured Output', () => {
  const memory = new MockMemory();
  const requestContext = new RequestContext();

  // Schema for structured network output
  const resultSchema = z.object({
    summary: z.string().describe('A brief summary of the task result'),
    recommendations: z.array(z.string()).describe('List of recommendations'),
    confidence: z.number().min(0).max(1).describe('Confidence score'),
  });

  // Expected structured result
  const structuredResult = {
    summary: 'Task completed successfully',
    recommendations: ['Recommendation 1', 'Recommendation 2'],
    confidence: 0.95,
  };

  // Mock scorer that always passes
  const alwaysPassScorer = {
    id: 'always-pass',
    name: 'Always Pass Scorer',
    run: vi.fn().mockResolvedValue({ score: 1, reason: 'Always passes' }),
  };

  /**
   * Creates a mock model that handles the network flow:
   * 1. First call: Routing decision
   * 2. Second call: Structured output generation (when schema is provided)
   */
  function createNetworkMockModel(options: {
    routingResponse?: object;
    structuredResult?: object;
  }) {
    const routingResponse = JSON.stringify(
      options.routingResponse ?? {
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Task handled directly',
      },
    );

    const structuredResultJson = JSON.stringify(options.structuredResult ?? structuredResult);

    let callCount = 0;

    return new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        // First call is routing, subsequent calls return structured result
        const text = callCount === 1 ? routingResponse : structuredResultJson;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text }],
          warnings: [],
        };
      },
      doStream: async () => {
        callCount++;
        // First call is routing, subsequent calls return structured result
        const text = callCount === 1 ? routingResponse : structuredResultJson;

        // For structured output, stream the JSON in chunks like structured-output.test.ts does
        const chunks =
          callCount === 1
            ? [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start' as const, id: 'text-1' },
                { type: 'text-delta' as const, id: 'text-1', delta: text },
                { type: 'text-end' as const, id: 'text-1' },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]
            : [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'response-metadata' as const, id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start' as const, id: 'text-2' },
                // Stream JSON incrementally like the structured output tests do
                { type: 'text-delta' as const, id: 'text-2', delta: '{ ' },
                { type: 'text-delta' as const, id: 'text-2', delta: '"summary": "Task completed successfully", ' },
                {
                  type: 'text-delta' as const,
                  id: 'text-2',
                  delta: '"recommendations": ["Recommendation 1", "Recommendation 2"], ',
                },
                { type: 'text-delta' as const, id: 'text-2', delta: '"confidence": 0.95 ' },
                { type: 'text-delta' as const, id: 'text-2', delta: '}' },
                { type: 'text-end' as const, id: 'text-2' },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
                },
              ];

        return {
          stream: convertArrayToReadableStream(chunks),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  }

  describe('NetworkOptions type should include structuredOutput', () => {
    it('should have structuredOutput as a valid option in NetworkOptions type', () => {
      // This test verifies the TYPE includes structuredOutput
      type HasStructuredOutput = NetworkOptions extends { structuredOutput?: unknown } ? true : false;
      const hasOption: HasStructuredOutput = true;
      expect(hasOption).toBe(true);
    });
  });

  describe('MastraAgentNetworkStream should have object getter', () => {
    it('should expose .object getter that returns a Promise', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test task', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
      });

      // Consume stream
      for await (const _chunk of stream) {
        // Process
      }

      // Test that .object getter exists and is a Promise
      expect(stream).toHaveProperty('object');
      expect(typeof (stream as any).object?.then).toBe('function');
    });
  });

  describe('MastraAgentNetworkStream should have objectStream getter', () => {
    it('should expose .objectStream getter that returns a ReadableStream', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test task', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
      });

      // Test that .objectStream getter exists
      expect(stream).toHaveProperty('objectStream');
      expect((stream as any).objectStream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('Structured output with schema option', () => {
    it('should return typed object when structuredOutput.schema is provided', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test structured output',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Analyze this', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      // Consume stream
      for await (const _chunk of stream) {
        // Process
      }

      // Get the structured object
      const result = await stream.object;

      // These assertions verify the feature is implemented
      expect(result).toBeDefined();
      expect(result).not.toBeUndefined();
      expect(result!.summary).toBe(structuredResult.summary);
      expect(result!.recommendations).toEqual(structuredResult.recommendations);
      expect(result!.confidence).toBe(structuredResult.confidence);
    });
  });

  describe('Network chunk types for structured output', () => {
    it('should emit network-object-result chunk with typed object', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test object chunks',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check chunks', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      let objectResultChunk: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'network-object-result') {
          objectResultChunk = chunk;
        }
      }

      // This will pass when the feature emits network-object-result chunks
      expect(objectResultChunk).not.toBeNull();
      expect(objectResultChunk.payload.object).toEqual(structuredResult);
    });

    it('should include object property in NetworkFinishPayload', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test finish payload',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check finish payload', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      let finishPayload: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'network-execution-event-finish') {
          finishPayload = chunk.payload;
        }
      }

      expect(finishPayload).toBeDefined();
      // NetworkFinishPayload should include object property
      expect(finishPayload).toHaveProperty('object');
      expect(finishPayload.object).toEqual(structuredResult);
    });
  });

  describe('Streaming partial objects', () => {
    it('should stream partial objects via objectStream', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test streaming',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Stream test', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      const partialObjects: any[] = [];

      // objectStream should be defined
      const objectStream = stream.objectStream;
      expect(objectStream).toBeDefined();

      // Start consuming objectStream in background
      const objectStreamPromise = (async () => {
        for await (const partial of objectStream) {
          partialObjects.push(partial);
        }
      })();

      // Consume main stream
      for await (const _chunk of stream) {
        // Process
      }

      // Wait for objectStream to finish
      await objectStreamPromise;

      // Should have received at least one partial object
      expect(partialObjects.length).toBeGreaterThan(0);
    });

    it('should emit network-object chunks during streaming', async () => {
      const mockModel = createNetworkMockModel({ structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test object chunks',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Partial chunks test', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      const objectChunks: any[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'network-object') {
          objectChunks.push(chunk);
        }
      }

      // network-object chunks should be emitted during streaming
      expect(objectChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Structured output with sub-agents', () => {
    it('should generate structured output after sub-agent completes', async () => {
      const subAgentResponse = 'Detailed analysis results from sub-agent.';

      const subAgentMockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
          content: [{ type: 'text', text: subAgentResponse }],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'sub-agent-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: subAgentResponse },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const subAgent = new Agent({
        id: 'research-agent',
        name: 'Research Agent',
        description: 'Performs detailed research',
        instructions: 'Research topics thoroughly',
        model: subAgentMockModel,
      });

      // Routing agent selects sub-agent first, then handles structured output
      const routingSelectAgent = JSON.stringify({
        primitiveId: 'research-agent',
        primitiveType: 'agent',
        prompt: 'Analyze this topic',
        selectionReason: 'Delegating to research agent',
      });

      const structuredResultJson = JSON.stringify(structuredResult);

      let callCount = 0;
      const routingMockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          const text = callCount === 1 ? routingSelectAgent : structuredResultJson;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text }],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          const text = callCount === 1 ? routingSelectAgent : structuredResultJson;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'routing-model', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: text },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const networkAgent = new Agent({
        id: 'orchestrator',
        name: 'Orchestrator',
        instructions: 'Coordinate research tasks',
        model: routingMockModel,
        agents: { 'research-agent': subAgent },
        memory,
      });

      const stream = await networkAgent.network('Research and summarize', {
        requestContext,
        completion: { scorers: [alwaysPassScorer as any] },
        structuredOutput: {
          schema: resultSchema,
        },
      });

      let agentExecutionSeen = false;

      for await (const chunk of stream) {
        if (chunk.type === 'agent-execution-end') {
          agentExecutionSeen = true;
        }
      }

      expect(agentExecutionSeen).toBe(true);

      // Get structured result
      const result = await stream.object;

      expect(result).toBeDefined();
      expect(result).toEqual(structuredResult);
    });
  });

  describe('Backward compatibility', () => {
    it('should work without structuredOutput option (existing behavior preserved)', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Handled directly',
      });

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: routingResponse }],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: routingResponse },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test backward compatibility',
        model: mockModel,
        memory,
      });

      // Call WITHOUT structuredOutput - existing behavior
      const stream = await networkAgent.network('Plain request', {
        requestContext,
        completion: {
          scorers: [alwaysPassScorer as any],
        },
      });

      let finishPayload: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'network-execution-event-finish') {
          finishPayload = chunk.payload;
        }
      }

      // Existing behavior should still work
      expect(finishPayload).toBeDefined();
      expect(finishPayload.result).toBeDefined();
      expect(typeof finishPayload.result).toBe('string');

      // object should be undefined when no structuredOutput provided
      expect(finishPayload.object).toBeUndefined();
    });
  });
});
