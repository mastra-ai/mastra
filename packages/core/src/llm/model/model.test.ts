import type { CoreMessage } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { createTool } from '../../tools';

import { MockProvider } from './mock';

describe('MastraLLM', () => {
  const mockMastra = {
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    } as any,
  };

  const mockToolExecute = vi.fn().mockResolvedValue('tool result');

  const mockTools = {
    testTool: createTool({
      id: 'testTool',
      inputSchema: z.object({ test: z.string() }),
      description: 'Test tool description',
      execute: async ({ context, threadId, resourceId }, options) => {
        return mockToolExecute({ ...context, threadId, resourceId }, options);
      },
    }),
  };

  const generateSpy = vi.fn();
  const streamSpy = vi.fn();

  const aisdkText = new MockProvider({
    spyGenerate: generateSpy,
    spyStream: streamSpy,
    mockText: 'Custom text response',
  });

  aisdkText.__registerPrimitives(mockMastra as any);

  const aisdkObject = new MockProvider({
    spyGenerate: generateSpy,
    spyStream: streamSpy,
    objectGenerationMode: 'json',
    mockText: { content: 'Custom object response' },
  });

  aisdkObject.__registerPrimitives(mockMastra as any);

  const aisdkArray = new MockProvider({
    spyGenerate: generateSpy,
    spyStream: streamSpy,
    objectGenerationMode: 'json',
    mockText: { content: ['Custom object response'] },
  });

  aisdkArray.__registerPrimitives(mockMastra as any);

  describe('constructor', () => {
    it('should initialize with model only', () => {
      expect(aisdkText).toBeDefined();
    });

    it('should initialize with both model and mastra', () => {
      expect(aisdkObject).toBeDefined();
    });
  });

  describe('convertTools', () => {
    it('should convert tools correctly', () => {
      const converted = aisdkText.convertTools({ tools: mockTools });

      expect(converted).toHaveProperty('testTool');

      expect(converted.testTool).toMatchObject({
        description: 'Test tool description',
        parameters: mockTools.testTool.inputSchema,
      });

      expect(typeof converted.testTool.execute).toBe('function');
    });

    it('should handle empty tools input', () => {
      const converted = aisdkText.convertTools({ tools: {} });
      expect(converted).toEqual({});
    });

    it('should log debug messages during tool conversion', () => {
      aisdkText.convertTools({ tools: mockTools });
      expect(mockMastra.logger.debug).toHaveBeenCalledWith('Starting tool conversion for LLM');
      expect(mockMastra.logger.debug).toHaveBeenCalledWith('Converted tools for LLM');
    });

    it('should execute tool with correct context', async () => {
      const converted = aisdkText.convertTools({ tools: mockTools });
      expect(converted).toBeDefined();
      expect(converted.testTool).toBeDefined();
      if (converted.testTool.execute) {
        await converted.testTool.execute({ test: 'value' }, { toolCallId: '1', messages: [] });
      }

      expect(mockToolExecute).toHaveBeenCalledWith({ test: 'value' }, { toolCallId: '1', messages: [] });
    });

    it('should pass threadId and resourceId to tool execution context', async () => {
      const threadId = 'test-thread-123';
      const resourceId = 'test-resource-456';
      const converted = aisdkText.convertTools({ tools: mockTools, threadId, resourceId });

      expect(converted).toBeDefined();
      expect(converted.testTool).toBeDefined();
      if (converted.testTool.execute) {
        await converted.testTool.execute({ test: 'value' }, { toolCallId: '1', messages: [] });
      }

      expect(mockToolExecute).toHaveBeenCalledWith(
        {
          test: 'value',
          threadId,
          resourceId,
        },
        { toolCallId: '1', messages: [] },
      );
    });

    it('should handle undefined threadId and resourceId', async () => {
      const converted = aisdkText.convertTools({ tools: mockTools });

      expect(converted).toBeDefined();
      expect(converted.testTool).toBeDefined();
      if (converted.testTool.execute) {
        await converted.testTool.execute({ test: 'value' }, { toolCallId: '1', messages: [] });
      }

      expect(mockToolExecute).toHaveBeenCalledWith({ test: 'value' }, { toolCallId: '1', messages: [] });
    });
  });

  describe('generate', () => {
    it('should generate text output by default', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const result = await aisdkText.generate(messages, {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should generate structured output when output is provided', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const schema = z.object({
        content: z.string(),
      });

      const result = await aisdkObject.generate(messages, {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
        output: schema,
      });

      expect(generateSpy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should convert string message to CoreMessage format', async () => {
      const result = await aisdkText.generate('test message', {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should convert string array to CoreMessage format', async () => {
      const result = await aisdkText.generate(['message 1', 'message 2'], {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should pass through tool conversion', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      await aisdkText.generate(messages, {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle onStepFinish callback', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const onStepFinish = vi.fn();

      await aisdkText.generate(messages, {
        tools: mockTools,
        onStepFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });
  });

  describe('stream', () => {
    it('should stream text by default', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      await aisdkText.stream(messages, {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle string messages', async () => {
      await aisdkText.stream('test message', {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle array of string messages', async () => {
      await aisdkText.stream(['test message 1', 'test message 2'], {
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should stream structured output with Zod schema', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });

      await aisdkObject.stream(messages, {
        tools: mockTools,
        output: schema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should stream structured output with JSON schema', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const jsonSchema = {
        type: 'object',
        properties: {
          content: { type: 'string' },
        },
        required: ['content'],
      } as JSONSchema7;

      await aisdkObject.stream(messages, {
        tools: mockTools,
        output: jsonSchema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle callbacks for text streaming', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const onStepFinish = vi.fn();
      const onFinish = vi.fn();

      await aisdkText.stream(messages, {
        tools: mockTools,
        onStepFinish,
        onFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle callbacks for structured output streaming', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });
      const onStepFinish = vi.fn();
      const onFinish = vi.fn();

      await aisdkObject.stream(messages, {
        tools: mockTools,
        output: schema,
        onStepFinish,
        onFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });
  });

  describe('__text', () => {
    it('should generate text with correct parameters', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const result = await aisdkText.__text({
        messages,
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();

      expect(result.text).toEqual('Custom text response');
    });

    it('should handle tool conversion', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      await aisdkText.__text({
        messages,
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle pre-converted tools', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const convertedTools = aisdkText.convertTools({ tools: mockTools });

      await aisdkText.__text({
        messages,
        convertedTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle onStepFinish callback', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const onStepFinish = vi.fn();

      await aisdkText.__text({
        messages,
        onStepFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const onStepFinish = vi.fn();
      // const mockResponse = {
      //   response: {
      //     headers: {
      //       'x-ratelimit-remaining-tokens': '1500',
      //     },
      //   },
      // };

      await aisdkText.__text({
        messages,
        onStepFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should log debug messages', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const runId = 'test-run';

      await aisdkText.__text({
        messages,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle step change logging', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const runId = 'test-run';
      // const mockStepData = {
      //   text: 'Custom text response',
      //   toolCalls: [],
      //   toolResults: [],
      //   finishReason: 'stop',
      //   usage: { promptTokens: 10, completionTokens: 20 },
      // };

      await aisdkText.__text({
        messages,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });
  });

  describe('__stream', () => {
    it('should stream text with correct parameters', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      await aisdkText.__stream({
        messages,
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle tool conversion', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      await aisdkText.__stream({
        messages,
        tools: mockTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle pre-converted tools', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const convertedTools = aisdkText.convertTools({ tools: mockTools });

      await aisdkText.__stream({
        messages,
        convertedTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle callbacks', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const onStepFinish = vi.fn();
      const onFinish = vi.fn();

      await aisdkText.__stream({
        messages,
        onStepFinish,
        onFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should log debug messages', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const runId = 'test-run';

      await aisdkText.__stream({
        messages,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();

      expect(mockMastra.logger.debug).toHaveBeenCalledWith(
        '[LLM] - Streaming text',
        expect.objectContaining({
          runId,
          messages: expect.any(Array),
          maxSteps: 5,
        }),
      );
    });

    it('should handle step change logging', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const runId = 'test-run';
      // const mockStepData = {
      //   text: 'Custom text response',
      //   toolCalls: [],
      //   toolResults: [],
      //   finishReason: 'stop',
      //   usage: { promptTokens: 10, completionTokens: 20 },
      // };

      await aisdkText.__stream({
        messages,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });
  });

  describe('__textObject', () => {
    it('should generate structured output with Zod schema', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const schema = z.object({
        content: z.string(),
      });

      const result = await aisdkObject.__textObject({
        messages,
        structuredOutput: schema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(result.object.content).toEqual('Custom object response');
    });

    it('should handle array type schemas', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const arraySchema = z.object({ content: z.array(z.string()) });

      await aisdkArray.__textObject({
        messages,
        structuredOutput: arraySchema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should handle JSON schema input', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const jsonSchema = {
        type: 'object',
        properties: {
          content: { type: 'string' },
        },
        required: ['content'],
      } as JSONSchema7;

      await aisdkObject.__textObject({
        messages,
        structuredOutput: jsonSchema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(generateSpy).toHaveBeenCalled();
    });

    it('should integrate tools correctly', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];

      const schema = z.object({
        content: z.string(),
      });

      await aisdkObject.__textObject({
        messages,
        tools: mockTools,
        structuredOutput: schema,
        temperature: 0.7,
        maxSteps: 5,
      });
    });
  });

  describe('__streamObject', () => {
    it('should stream object with Zod schema', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });

      await aisdkObject.__streamObject({
        messages,
        tools: mockTools,
        structuredOutput: schema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle array type schemas', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const arraySchema = z.object({ content: z.array(z.string()) });

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: arraySchema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle JSON schema input', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const jsonSchema = {
        type: 'object',
        properties: {
          content: { type: 'string' },
        },
        required: ['content'],
      } as JSONSchema7;

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: jsonSchema,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle callbacks', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });
      const onStepFinish = vi.fn();
      const onFinish = vi.fn();

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: schema,
        onStepFinish,
        onFinish,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should log debug messages', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });
      const runId = 'test-run';

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: schema,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle pre-converted tools', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });
      const convertedTools = aisdkObject.convertTools({ tools: mockTools });

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: schema,
        convertedTools,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      const messages: CoreMessage[] = [{ role: 'user', content: 'test message' }];
      const schema = z.object({
        content: z.string(),
      });
      const runId = 'test-run';

      await aisdkObject.__streamObject({
        messages,
        structuredOutput: schema,
        runId,
        temperature: 0.7,
        maxSteps: 5,
      });

      expect(streamSpy).toHaveBeenCalled();
    });
  });
});
