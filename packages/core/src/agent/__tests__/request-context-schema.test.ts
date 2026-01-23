import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

describe('Agent requestContextSchema', () => {
  const requestContextSchema = z.object({
    userId: z.string(),
    apiKey: z.string(),
  });

  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you?',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'text-delta',
            textDelta: 'Hello! ',
          },
          {
            type: 'text-delta',
            textDelta: 'How can I help you?',
          },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  });

  describe('generate validation', () => {
    it('should pass validation when requestContext matches schema', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const result = await agent.generate('Hello', { requestContext });

      expect(result.text).toContain('Hello');
    });

    it('should throw validation error when requestContext is missing required fields', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext<{ userId: string }>();
      requestContext.set('userId', 'user-123');
      // Missing apiKey

      await expect(agent.generate('Hello', { requestContext })).rejects.toThrow(
        /Request context validation failed for agent/,
      );
    });

    it('should throw validation error when requestContext has invalid field types', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 123 as any); // Wrong type
      requestContext.set('apiKey', 'key-456');

      await expect(agent.generate('Hello', { requestContext })).rejects.toThrow(
        /Request context validation failed for agent/,
      );
    });

    it('should include agent ID in error message', async () => {
      const agent = new Agent({
        id: 'my-special-agent',
        name: 'My Special Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext();
      // Empty context

      await expect(agent.generate('Hello', { requestContext })).rejects.toThrow(/my-special-agent/);
    });
  });

  describe('stream validation', () => {
    it('should pass validation when requestContext matches schema', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      // If validation passes, stream() should not throw
      const result = await agent.stream('Hello', { requestContext });
      expect(result).toBeDefined();
      // Consume the stream
      await result.getFullOutput();
    });

    it('should throw validation error when requestContext is missing required fields', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext<{ userId: string }>();
      requestContext.set('userId', 'user-123');
      // Missing apiKey

      await expect(agent.stream('Hello', { requestContext })).rejects.toThrow(
        /Request context validation failed for agent/,
      );
    });

    it('should throw validation error when requestContext has invalid field types', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        requestContextSchema,
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 123 as any); // Wrong type
      requestContext.set('apiKey', 'key-456');

      await expect(agent.stream('Hello', { requestContext })).rejects.toThrow(
        /Request context validation failed for agent/,
      );
    });
  });

  describe('backwards compatibility', () => {
    it('should work without requestContextSchema on agent', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('anything', 'value');

      const result = await agent.generate('Hello', { requestContext });

      expect(result.text).toContain('Hello');
    });

    it('should work without requestContext parameter', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
      });

      const result = await agent.generate('Hello');

      expect(result.text).toContain('Hello');
    });

    it('should work with stream without requestContext parameter', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: mockModel,
      });

      // If no schema, stream() should not throw
      const result = await agent.stream('Hello');
      expect(result).toBeDefined();
      // Consume the stream
      await result.getFullOutput();
    });
  });

  describe('typed requestContext access', () => {
    it('should provide typed requestContext in dynamic instructions', async () => {
      const contextSchema = z.object({
        userName: z.string(),
      });

      let capturedContext: any;
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext }) => {
          capturedContext = requestContext;
          return `You are a helpful assistant for ${requestContext.get('userName')}`;
        },
        model: mockModel,
        requestContextSchema: contextSchema,
      });

      const requestContext = new RequestContext<{ userName: string }>();
      requestContext.set('userName', 'John');

      await agent.generate('Hello', { requestContext });

      expect(capturedContext.get('userName')).toBe('John');
      expect(capturedContext.all.userName).toBe('John');
    });
  });
});
