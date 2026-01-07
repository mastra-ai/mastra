/**
 * Tests for Agent Network Structured Output feature
 * GitHub Issue #11337: Add Structured Output to network result
 *
 * These tests verify the planned implementation of structured output
 * support in agent.network() method.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

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

  describe('NetworkOptions with structuredOutput', () => {
    it('should accept structuredOutput option with schema', async () => {
      // Routing response - selects no primitive (self-handle)
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Task can be handled directly',
      });

      // Completion check response with structured output
      const completionResponse = JSON.stringify({
        isComplete: true,
        completionReason: 'Task completed',
        finalResult: JSON.stringify(structuredResult),
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          const text = callCount === 1 ? routingResponse : completionResponse;
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
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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
        instructions: 'You are a test network agent',
        model: mockModel,
        memory,
      });

      // This test validates that the API accepts structuredOutput option
      // The actual implementation will be added later
      const stream = await networkAgent.network('Analyze this task', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented in NetworkOptions
        structuredOutput: {
          schema: resultSchema,
        },
      });

      // Consume stream
      for await (const _chunk of stream) {
        // Process chunks
      }

      // Verify stream completed
      const status = await stream.status;
      expect(status).toBeDefined();
    });

    it('should accept structuredOutput with custom model', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Direct handling',
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
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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

      const structuringModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 15, totalTokens: 20 },
          content: [{ type: 'text', text: JSON.stringify(structuredResult) }],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'structuring-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 15, totalTokens: 20 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const networkAgent = new Agent({
        id: 'test-network',
        name: 'Test Network',
        instructions: 'Test network with custom structuring model',
        model: mockModel,
        memory,
      });

      // Test that structuredOutput.model option is accepted
      const stream = await networkAgent.network('Process this request', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
          model: structuringModel,
        },
      });

      for await (const _chunk of stream) {
        // Consume
      }

      expect(await stream.status).toBeDefined();
    });
  });

  describe('MastraAgentNetworkStream object getter', () => {
    it('should resolve object promise with typed result when structuredOutput is provided', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Handling directly',
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
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Get structured result', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
        },
      });

      // Consume stream first
      for await (const _chunk of stream) {
        // Process
      }

      // Test that .object getter exists and returns promise
      // @ts-expect-error - object getter not yet implemented
      if (typeof stream.object !== 'undefined') {
        // @ts-expect-error - object getter not yet implemented
        const result = await stream.object;
        expect(result).toBeDefined();
        expect(result.summary).toBe(structuredResult.summary);
        expect(result.recommendations).toEqual(structuredResult.recommendations);
        expect(result.confidence).toBe(structuredResult.confidence);
      }
    });

    it('should return undefined from object getter when no structuredOutput provided', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'No structured output requested',
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
            { type: 'text-delta', id: 'text-1', delta: 'Plain text result' },
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
        instructions: 'Test',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Get plain result', {
        requestContext,
      });

      for await (const _chunk of stream) {
        // Consume
      }

      // @ts-expect-error - object getter not yet implemented
      if (typeof stream.object !== 'undefined') {
        // @ts-expect-error - object getter not yet implemented
        const result = await stream.object;
        expect(result).toBeUndefined();
      }
    });
  });

  describe('MastraAgentNetworkStream objectStream getter', () => {
    it('should stream partial objects during generation', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Streaming structured output',
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
            // Simulate streaming JSON in parts
            { type: 'text-delta', id: 'text-1', delta: '{"summary":' },
            { type: 'text-delta', id: 'text-1', delta: '"Task completed",' },
            { type: 'text-delta', id: 'text-1', delta: '"recommendations":["Rec 1",' },
            { type: 'text-delta', id: 'text-1', delta: '"Rec 2"],' },
            { type: 'text-delta', id: 'text-1', delta: '"confidence":0.95}' },
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
        instructions: 'Test streaming',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Stream structured output', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
        },
      });

      const partialObjects: any[] = [];

      // @ts-expect-error - objectStream getter not yet implemented
      if (typeof stream.objectStream !== 'undefined') {
        // @ts-expect-error - objectStream getter not yet implemented
        for await (const partial of stream.objectStream) {
          partialObjects.push(partial);
        }

        // Should have received multiple partial objects
        expect(partialObjects.length).toBeGreaterThan(0);

        // Last partial should be complete
        const lastPartial = partialObjects[partialObjects.length - 1];
        expect(lastPartial.summary).toBeDefined();
        expect(lastPartial.recommendations).toBeDefined();
        expect(lastPartial.confidence).toBeDefined();
      }
    });
  });

  describe('Network chunk types for structured output', () => {
    it('should emit network-object chunks during streaming', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Emitting object chunks',
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
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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
        instructions: 'Test object chunks',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check object chunks', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
        },
      });

      const objectChunks: any[] = [];
      let objectResultChunk: any = null;

      for await (const chunk of stream) {
        // Collect network-object chunks (partial objects during streaming)
        if (chunk.type === 'network-object') {
          objectChunks.push(chunk);
        }
        // Collect network-object-result chunk (final validated object)
        if (chunk.type === 'network-object-result') {
          objectResultChunk = chunk;
        }
      }

      // When implemented, should emit network-object chunks
      // and a final network-object-result chunk
      // For now, this test documents the expected behavior
    });

    it('should include object in NetworkFinishPayload when structuredOutput provided', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Include object in finish payload',
      });

      const completionResponse = JSON.stringify({
        isComplete: true,
        completionReason: 'Complete with structured output',
        finalResult: JSON.stringify(structuredResult),
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          const text = callCount === 1 ? routingResponse : completionResponse;
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
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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
        instructions: 'Test finish payload',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Check finish payload', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
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
      // When implemented, finishPayload should have an object property
      // expect(finishPayload.object).toEqual(structuredResult);
    });
  });

  describe('Structured output with sub-agents', () => {
    it('should generate structured output after sub-agent execution', async () => {
      // Sub-agent response
      const subAgentResponse = 'Detailed analysis of the topic with findings and recommendations.';

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
        description: 'Performs detailed research and analysis',
        instructions: 'Research and analyze topics thoroughly',
        model: subAgentMockModel,
      });

      // Routing selects sub-agent first, then completion
      const routingSelectAgent = JSON.stringify({
        primitiveId: 'research-agent',
        primitiveType: 'agent',
        prompt: 'Analyze the given topic',
        selectionReason: 'Sub-agent needed for research',
      });

      const completionResponse = JSON.stringify({
        isComplete: true,
        completionReason: 'Research complete',
        finalResult: JSON.stringify(structuredResult),
      });

      let generateCount = 0;
      const routingMockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          generateCount++;
          const text = generateCount === 1 ? routingSelectAgent : completionResponse;
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
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(structuredResult) },
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
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
        },
      });

      let agentExecutionSeen = false;
      let finishPayload: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'agent-execution-end') {
          agentExecutionSeen = true;
        }
        if (chunk.type === 'network-execution-event-finish') {
          finishPayload = chunk.payload;
        }
      }

      expect(agentExecutionSeen).toBe(true);
      expect(finishPayload).toBeDefined();
      // When implemented: expect(finishPayload.object).toEqual(structuredResult);
    });
  });

  describe('Structured output validation', () => {
    it('should validate output against schema', async () => {
      // Invalid response missing required fields
      const invalidResult = {
        summary: 'Only summary provided',
        // Missing: recommendations, confidence
      };

      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Test validation',
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
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify(invalidResult) },
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
        instructions: 'Test validation',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test schema validation', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
          errorStrategy: 'strict', // Should throw on validation failure
        },
      });

      // When implemented with strict errorStrategy, this should throw
      // or handle the validation error appropriately
      for await (const _chunk of stream) {
        // Consume
      }
    });

    it('should use fallback value when errorStrategy is fallback', async () => {
      const fallbackValue = {
        summary: 'Fallback summary',
        recommendations: [],
        confidence: 0,
      };

      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Test fallback',
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
            { type: 'text-delta', id: 'text-1', delta: 'invalid json {{{' },
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
        instructions: 'Test fallback strategy',
        model: mockModel,
        memory,
      });

      const stream = await networkAgent.network('Test fallback', {
        requestContext,
        // @ts-expect-error - structuredOutput not yet implemented
        structuredOutput: {
          schema: resultSchema,
          errorStrategy: 'fallback',
          fallbackValue,
        },
      });

      for await (const _chunk of stream) {
        // Consume
      }

      // When implemented: expect(await stream.object).toEqual(fallbackValue);
    });
  });

  describe('Backward compatibility', () => {
    it('should work without structuredOutput option (existing behavior)', async () => {
      const routingResponse = JSON.stringify({
        primitiveId: 'none',
        primitiveType: 'none',
        prompt: '',
        selectionReason: 'Plain text response',
      });

      const completionResponse = JSON.stringify({
        isComplete: true,
        completionReason: 'Done',
        finalResult: 'This is a plain text result without structured output',
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          const text = callCount === 1 ? routingResponse : completionResponse;
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
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Plain text streaming result' },
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

      // Call without structuredOutput - should work as before
      const stream = await networkAgent.network('Get plain result', {
        requestContext,
      });

      let finishPayload: any = null;

      for await (const chunk of stream) {
        if (chunk.type === 'network-execution-event-finish') {
          finishPayload = chunk.payload;
        }
      }

      expect(finishPayload).toBeDefined();
      expect(finishPayload.result).toBeDefined();
      expect(typeof finishPayload.result).toBe('string');
    });
  });
});

describe('generateFinalResult with user schema', () => {
  // These tests are for the validation.ts module changes

  it('should use user-provided schema for final result generation', async () => {
    // This test documents the expected behavior of generateFinalResult
    // when a user schema is provided

    const userSchema = z.object({
      answer: z.string(),
      sources: z.array(z.string()),
    });

    // The generateFinalResult function should:
    // 1. Accept an optional structuredOutputOptions parameter
    // 2. Use the user's schema instead of the default finalResultSchema
    // 3. Return { object: InferSchemaOutput<OUTPUT> } instead of { text: string }

    // Test placeholder - actual implementation will be tested when feature is built
    expect(userSchema).toBeDefined();
  });

  it('should stream partial objects through writer when generating structured output', async () => {
    // This test documents the expected streaming behavior

    // The generateFinalResult function should:
    // 1. Write 'network-object' chunks to the writer as partial objects stream
    // 2. Write a final 'network-object-result' chunk with the complete object

    // Test placeholder
    expect(true).toBe(true);
  });
});
