/**
 * Tests for Agent Network Structured Output feature
 * GitHub Issue #11337: Add Structured Output to network result
 *
 * These tests verify the planned implementation of structured output
 * support in agent.network() method.
 *
 * Tests are designed to FAIL until the feature is implemented (TDD approach).
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

  // Helper to create a mock model that handles routing properly
  function createNetworkMockModel(options: {
    routingResponse?: object;
    completionResponse?: object;
    finalResult?: object | string;
  }) {
    const routingResponse = JSON.stringify(
      options.routingResponse ?? {
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Task handled directly',
      },
    );

    const completionResponse = JSON.stringify(
      options.completionResponse ?? {
        isComplete: true,
        completionReason: 'Task completed',
        finalResult:
          typeof options.finalResult === 'string'
            ? options.finalResult
            : JSON.stringify(options.finalResult ?? structuredResult),
      },
    );

    let generateCallCount = 0;
    let streamCallCount = 0;

    return new MockLanguageModelV2({
      doGenerate: async () => {
        generateCallCount++;
        // First call is routing, subsequent calls are completion check
        const text = generateCallCount === 1 ? routingResponse : completionResponse;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text }],
          warnings: [],
        };
      },
      doStream: async () => {
        streamCallCount++;
        // Stream returns appropriate JSON based on call order
        const responseText = streamCallCount === 1 ? routingResponse : completionResponse;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: responseText },
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
  }

  describe('NetworkOptions type should include structuredOutput', () => {
    it('should have structuredOutput as a valid option in NetworkOptions type', () => {
      // This test verifies the TYPE includes structuredOutput
      // It will fail at compile time until NetworkOptions is updated

      type HasStructuredOutput = NetworkOptions extends { structuredOutput?: unknown } ? true : false;

      // When structuredOutput is added to NetworkOptions, this will be true
      const hasOption: HasStructuredOutput = false as HasStructuredOutput;

      // This assertion should PASS once the type is updated
      // For now, we expect it to be false (feature not implemented)
      expect(hasOption).toBe(true);
    });
  });

  describe('MastraAgentNetworkStream should have object getter', () => {
    it('should expose .object getter that returns a Promise', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test task', {
        requestContext,
      });

      // Consume stream
      for await (const _chunk of stream) {
        // Process
      }

      // Test that .object getter exists
      // This will fail until MastraAgentNetworkStream is updated
      expect(stream).toHaveProperty('object');
      expect(typeof (stream as any).object?.then).toBe('function'); // Should be a Promise
    });
  });

  describe('MastraAgentNetworkStream should have objectStream getter', () => {
    it('should expose .objectStream getter that returns a ReadableStream', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test task', {
        requestContext,
      });

      // Test that .objectStream getter exists
      // This will fail until MastraAgentNetworkStream is updated
      expect(stream).toHaveProperty('objectStream');
      expect((stream as any).objectStream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('Structured output with schema option', () => {
    it('should return typed object when structuredOutput.schema is provided', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test structured output',
        model: mockModel,
        memory,
      });

      // This will have a type error until NetworkOptions includes structuredOutput
      const stream = await networkAgent.network('Analyze this', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
        structuredOutput: {
          schema: resultSchema,
        },
      });

      // Consume stream
      for await (const _chunk of stream) {
        // Process
      }

      // Get the structured object
      const result = await (stream as any).object;

      // These assertions will fail until the feature is implemented
      expect(result).toBeDefined();
      expect(result).not.toBeUndefined();
      expect(result.summary).toBe(structuredResult.summary);
      expect(result.recommendations).toEqual(structuredResult.recommendations);
      expect(result.confidence).toBe(structuredResult.confidence);
    });
  });

  describe('Network chunk types for structured output', () => {
    it('should emit network-object-result chunk with typed object', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test object chunks',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check chunks', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
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

      // This will fail until the feature emits network-object-result chunks
      expect(objectResultChunk).not.toBeNull();
      expect(objectResultChunk.object).toEqual(structuredResult);
    });

    it('should include object property in NetworkFinishPayload', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test finish payload',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check finish payload', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
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
      // This will fail until NetworkFinishPayload includes object property
      expect(finishPayload).toHaveProperty('object');
      expect(finishPayload.object).toEqual(structuredResult);
    });
  });

  describe('Streaming partial objects', () => {
    it('should stream partial objects via objectStream', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test streaming',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Stream test', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
        structuredOutput: {
          schema: resultSchema,
        },
      });

      const partialObjects: any[] = [];

      // This will fail until objectStream is implemented
      const objectStream = (stream as any).objectStream;
      expect(objectStream).toBeDefined();

      if (objectStream) {
        for await (const partial of objectStream) {
          partialObjects.push(partial);
        }
      }

      // Should have received at least one partial object
      expect(partialObjects.length).toBeGreaterThan(0);
    });

    it('should emit network-object chunks during streaming', async () => {
      const mockModel = createNetworkMockModel({ finalResult: structuredResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test object chunks',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Partial chunks test', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
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

      // This will fail until network-object chunks are emitted
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

      // Routing agent selects sub-agent
      const routingSelectAgent = JSON.stringify({
        primitiveId: 'research-agent',
        primitiveType: 'agent',
        prompt: 'Analyze this topic',
        selectionReason: 'Delegating to research agent',
      });

      const completionResponse = JSON.stringify({
        isComplete: true,
        completionReason: 'Research complete',
        finalResult: JSON.stringify(structuredResult),
      });

      let callCount = 0;
      const routingMockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          const text = callCount === 1 ? routingSelectAgent : completionResponse;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text }],
            warnings: [],
          };
        },
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'routing-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: completionResponse },
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
        id: 'orchestrator',
        name: 'Orchestrator',
        instructions: 'Coordinate research tasks',
        model: routingMockModel,
        agents: { 'research-agent': subAgent },
        memory,
      });

      const stream = await networkAgent.network('Research and summarize', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
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
      const result = await (stream as any).object;

      // This will fail until structured output is implemented
      expect(result).toBeDefined();
      expect(result).toEqual(structuredResult);
    });
  });

  describe('Error handling and validation', () => {
    it('should validate output against provided schema', async () => {
      // Return invalid data missing required fields
      const invalidResult = { summary: 'Only summary' }; // Missing recommendations and confidence

      const mockModel = createNetworkMockModel({ finalResult: invalidResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test validation',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test validation', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
        structuredOutput: {
          schema: resultSchema,
          errorStrategy: 'strict',
        },
      });

      // With strict strategy, should throw or return error
      let errorOccurred = false;
      try {
        for await (const _chunk of stream) {
          // Consume
        }
        await (stream as any).object;
      } catch (e) {
        errorOccurred = true;
      }

      // This will fail until validation is implemented
      expect(errorOccurred).toBe(true);
    });

    it('should use fallback value when validation fails with fallback strategy', async () => {
      const invalidResult = { invalid: 'data' };
      const fallbackValue = {
        summary: 'Fallback',
        recommendations: [],
        confidence: 0,
      };

      const mockModel = createNetworkMockModel({ finalResult: invalidResult });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test fallback',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test fallback', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet in NetworkOptions
        structuredOutput: {
          schema: resultSchema,
          errorStrategy: 'fallback',
          fallbackValue,
        },
      });

      for await (const _chunk of stream) {
        // Consume
      }

      const result = await (stream as any).object;

      // This will fail until fallback is implemented
      expect(result).toEqual(fallbackValue);
    });
  });

  describe('Backward compatibility', () => {
    it('should work without structuredOutput option (existing behavior preserved)', async () => {
      // Use a mock scorer to ensure completion without needing default completion check
      const mockScorer = {
        id: 'pass-scorer',
        name: 'Pass Scorer',
        run: vi.fn().mockResolvedValue({ score: 1, reason: 'Passed' }),
      };

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
          scorers: [mockScorer as any],
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
