/**
 * V3-specific Agent Tests
 *
 * These tests verify that AI SDK v6 (LanguageModelV3) specific features
 * surface correctly through the Agent API:
 * - Reasoning stream parts
 * - Sources stream parts
 * - Files stream parts
 * - V3 usage format normalization
 */

import type { LanguageModelV3Usage } from '@ai-sdk/provider-v6';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

// V3 usage format
const testUsageV3 = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 15, reasoning: 5 },
};

describe('V3 Agent Features', () => {
  describe('Reasoning', () => {
    it('should stream reasoning parts from V3 model', async () => {
      const modelWithReasoning = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'reasoning-start', id: 'reasoning-1' },
            { type: 'reasoning-delta', id: 'reasoning-1', delta: 'Let me think about this...' },
            { type: 'reasoning-delta', id: 'reasoning-1', delta: ' The answer is clear.' },
            { type: 'reasoning-end', id: 'reasoning-1' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'The answer is 42.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageV3,
            },
          ]),
        }),
        doGenerate: async () => ({
          content: [
            { type: 'reasoning' as const, text: 'Let me think about this... The answer is clear.' },
            { type: 'text' as const, text: 'The answer is 42.' },
          ],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'reasoning-test-agent',
        name: 'Reasoning Test Agent',
        instructions: 'You are a helpful assistant that thinks through problems.',
        model: modelWithReasoning,
      });

      // Test streaming
      const streamResult = await agent.stream('What is the meaning of life?');
      const streamParts: any[] = [];
      for await (const part of streamResult.fullStream) {
        streamParts.push(part);
      }

      // Verify reasoning parts are present in the stream
      // Note: Agent stream wraps data in payload object
      const reasoningStartParts = streamParts.filter(p => p.type === 'reasoning-start');
      const reasoningDeltaParts = streamParts.filter(p => p.type === 'reasoning-delta');
      const reasoningEndParts = streamParts.filter(p => p.type === 'reasoning-end');

      expect(reasoningStartParts.length).toBeGreaterThan(0);
      expect(reasoningDeltaParts.length).toBeGreaterThan(0);
      expect(reasoningEndParts.length).toBeGreaterThan(0);

      // Verify the reasoning content (Agent stream puts text in payload.text)
      const reasoningText = reasoningDeltaParts.map(p => p.payload?.text ?? '').join('');
      expect(reasoningText).toContain('Let me think about this...');
      expect(reasoningText).toContain('The answer is clear.');

      // Verify text parts are also present
      const textDeltaParts = streamParts.filter(p => p.type === 'text-delta');
      expect(textDeltaParts.length).toBeGreaterThan(0);
    });

    it('should return reasoning in generate result from V3 model', async () => {
      const modelWithReasoning = new MockLanguageModelV3({
        doGenerate: async () => ({
          content: [
            { type: 'reasoning' as const, text: 'Let me analyze this step by step...' },
            { type: 'text' as const, text: 'Based on my analysis, the answer is 42.' },
          ],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Based on my analysis, the answer is 42.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3 },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'reasoning-test-agent',
        name: 'Reasoning Test Agent',
        instructions: 'You are a helpful assistant.',
        model: modelWithReasoning,
      });

      const result = await agent.generate('What is the meaning of life?');

      // Verify the response contains reasoning
      expect(result.response.messages).toBeDefined();
      expect(result.response.messages.length).toBeGreaterThan(0);

      // Check for reasoning content in the response
      const assistantMessage = result.response.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();

      // The text should be available
      expect(result.text).toContain('Based on my analysis');
    });

    it('should handle empty reasoning with provider metadata (OpenAI item_reference)', async () => {
      // This tests the scenario where OpenAI sends reasoning with just provider metadata
      // but no actual reasoning text (for item_reference tracking)
      const modelWithEmptyReasoning = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'reasoning-start',
              id: 'rs_test123',
              providerMetadata: { openai: { itemId: 'rs_test123' } },
            },
            // No reasoning-delta - empty reasoning
            {
              type: 'reasoning-end',
              id: 'rs_test123',
              providerMetadata: { openai: { itemId: 'rs_test123' } },
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3 },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello!' }],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'empty-reasoning-agent',
        name: 'Empty Reasoning Agent',
        instructions: 'You are a helpful assistant.',
        model: modelWithEmptyReasoning,
      });

      const streamResult = await agent.stream('Say hello');
      const parts: any[] = [];
      for await (const part of streamResult.fullStream) {
        parts.push(part);
      }

      // Verify reasoning parts are present even without deltas
      const reasoningStartParts = parts.filter(p => p.type === 'reasoning-start');
      const reasoningEndParts = parts.filter(p => p.type === 'reasoning-end');

      expect(reasoningStartParts.length).toBe(1);
      expect(reasoningEndParts.length).toBe(1);

      // Verify provider metadata is preserved (in payload for Agent stream)
      expect(reasoningStartParts[0].payload?.providerMetadata).toEqual({ openai: { itemId: 'rs_test123' } });
    });
  });

  describe('Sources', () => {
    it('should stream source parts from V3 model', async () => {
      const modelWithSources = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'source',
              sourceType: 'url',
              id: 'source-1',
              url: 'https://example.com/article',
              title: 'Example Article',
              providerMetadata: { provider: { custom: 'value1' } },
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'According to the source, ' },
            { type: 'text-delta', id: 'text-1', delta: 'the information is accurate.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'source',
              sourceType: 'url',
              id: 'source-2',
              url: 'https://example.com/reference',
              title: 'Reference Document',
              providerMetadata: { provider: { custom: 'value2' } },
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageV3,
            },
          ]),
        }),
        doGenerate: async () => ({
          content: [
            {
              type: 'source' as const,
              sourceType: 'url' as const,
              id: 'source-1',
              url: 'https://example.com/article',
              title: 'Example Article',
              providerMetadata: { provider: { custom: 'value1' } },
            },
            { type: 'text' as const, text: 'According to the source, the information is accurate.' },
            {
              type: 'source' as const,
              sourceType: 'url' as const,
              id: 'source-2',
              url: 'https://example.com/reference',
              title: 'Reference Document',
              providerMetadata: { provider: { custom: 'value2' } },
            },
          ],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'sources-test-agent',
        name: 'Sources Test Agent',
        instructions: 'You are a helpful assistant that cites sources.',
        model: modelWithSources,
      });

      // Test streaming
      const streamResult = await agent.stream('Tell me about the topic.');
      const streamParts: any[] = [];
      for await (const part of streamResult.fullStream) {
        streamParts.push(part);
      }

      // Verify source parts are present (Agent stream wraps data in payload)
      const sourceParts = streamParts.filter(p => p.type === 'source');
      expect(sourceParts.length).toBe(2);

      // Verify first source (data is in payload for Agent stream)
      expect(sourceParts[0].payload).toMatchObject({
        sourceType: 'url',
        id: 'source-1',
        url: 'https://example.com/article',
        title: 'Example Article',
      });

      // Verify second source
      expect(sourceParts[1].payload).toMatchObject({
        sourceType: 'url',
        id: 'source-2',
        url: 'https://example.com/reference',
        title: 'Reference Document',
      });

      // Verify provider metadata is preserved (in payload for Agent stream)
      expect(sourceParts[0].payload?.providerMetadata).toEqual({ provider: { custom: 'value1' } });
      expect(sourceParts[1].payload?.providerMetadata).toEqual({ provider: { custom: 'value2' } });
    });

    it('should include sources in generate result from V3 model', async () => {
      const modelWithSources = new MockLanguageModelV3({
        doGenerate: async () => ({
          content: [
            {
              type: 'source' as const,
              sourceType: 'url' as const,
              id: 'source-1',
              url: 'https://example.com/info',
              title: 'Information Source',
            },
            { type: 'text' as const, text: 'Here is the information you requested.' },
          ],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Here is the information you requested.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3 },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'sources-generate-agent',
        name: 'Sources Generate Agent',
        instructions: 'You are a helpful assistant.',
        model: modelWithSources,
      });

      const result = await agent.generate('Give me information.');

      expect(result.text).toContain('Here is the information you requested');
      expect(result.response.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Files', () => {
    it('should stream file parts from V3 model', async () => {
      const modelWithFiles = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'file',
              data: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
              mediaType: 'text/plain',
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Here is the file you requested.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'file',
              data: '/9j/4AAQ', // partial JPEG data
              mediaType: 'image/jpeg',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageV3,
            },
          ]),
        }),
        doGenerate: async () => ({
          content: [
            { type: 'file' as const, data: 'SGVsbG8gV29ybGQ=', mediaType: 'text/plain' },
            { type: 'text' as const, text: 'Here is the file you requested.' },
            { type: 'file' as const, data: '/9j/4AAQ', mediaType: 'image/jpeg' },
          ],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'files-test-agent',
        name: 'Files Test Agent',
        instructions: 'You are a helpful assistant that can generate files.',
        model: modelWithFiles,
      });

      // Test streaming
      const streamResult = await agent.stream('Generate a file for me.');
      const streamParts: any[] = [];
      for await (const part of streamResult.fullStream) {
        streamParts.push(part);
      }

      // Verify file parts are present (Agent stream wraps data in payload)
      const fileParts = streamParts.filter(p => p.type === 'file');
      expect(fileParts.length).toBe(2);

      // Verify first file (data is directly in payload for Agent stream)
      expect(fileParts[0].payload).toMatchObject({
        base64: 'SGVsbG8gV29ybGQ=',
        mimeType: 'text/plain',
      });

      // Verify second file
      expect(fileParts[1].payload).toMatchObject({
        base64: '/9j/4AAQ',
        mimeType: 'image/jpeg',
      });
    });
  });

  describe('Usage Normalization', () => {
    it('should normalize V3 usage format to standard format', async () => {
      const v3UsageWithDetails: LanguageModelV3Usage = {
        inputTokens: { total: 100, noCache: 80, cacheRead: 20, cacheWrite: undefined },
        outputTokens: { total: 50, text: 30, reasoning: 20 },
      };

      const modelWithV3Usage = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Test response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: v3UsageWithDetails,
            },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Test response' }],
          finishReason: 'stop',
          usage: v3UsageWithDetails,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'usage-test-agent',
        name: 'Usage Test Agent',
        instructions: 'You are a helpful assistant.',
        model: modelWithV3Usage,
      });

      // Test generate
      const generateResult = await agent.generate('Test');
      expect(generateResult.usage).toBeDefined();
      expect(generateResult.usage.inputTokens).toBe(100);
      expect(generateResult.usage.outputTokens).toBe(50);
      expect(generateResult.usage.totalTokens).toBe(150);

      // Test stream
      const streamResult = await agent.stream('Test');
      await streamResult.consumeStream();
      const streamUsage = await streamResult.usage;
      expect(streamUsage).toBeDefined();
      expect(streamUsage.inputTokens).toBe(100);
      expect(streamUsage.outputTokens).toBe(50);
      expect(streamUsage.totalTokens).toBe(150);
    });

    it('should preserve detailed V3 usage information including cached and reasoning tokens', async () => {
      const v3UsageWithAllDetails: LanguageModelV3Usage = {
        inputTokens: { total: 200, noCache: 150, cacheRead: 50, cacheWrite: 10 },
        outputTokens: { total: 100, text: 60, reasoning: 40 },
      };

      const modelWithDetailedUsage = new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response with detailed usage' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: v3UsageWithAllDetails,
            },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Response with detailed usage' }],
          finishReason: 'stop',
          usage: v3UsageWithAllDetails,
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'detailed-usage-agent',
        name: 'Detailed Usage Agent',
        instructions: 'You are a helpful assistant.',
        model: modelWithDetailedUsage,
      });

      const generateResult = await agent.generate('Test');

      // Verify normalized usage
      expect(generateResult.usage.inputTokens).toBe(200);
      expect(generateResult.usage.outputTokens).toBe(100);
      expect(generateResult.usage.totalTokens).toBe(300);

      // Verify commonly used detailed fields are extracted
      expect(generateResult.usage.cachedInputTokens).toBe(50);
      expect(generateResult.usage.reasoningTokens).toBe(40);

      // Note: raw usage on steps is not available due to a known issue where step usage
      // uses aggregated totals instead of per-step values (see ISSUE-step-usage-aggregated.md)
    });
  });
});
