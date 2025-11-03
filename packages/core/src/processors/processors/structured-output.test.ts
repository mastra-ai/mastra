import type { TransformStreamDefaultController } from 'stream/web';
import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createTool } from '../../tools';
import type { Processor } from '../index';
import { StructuredOutputProcessor } from './structured-output';

describe('StructuredOutputProcessor', () => {
  const testSchema = z.object({
    color: z.string(),
    intensity: z.string(),
    count: z.number().optional(),
  });

  let processor: StructuredOutputProcessor<typeof testSchema>;
  let mockModel: MockLanguageModelV2;

  // Helper to create a mock controller that captures enqueued chunks
  function createMockController() {
    const enqueuedChunks: any[] = [];
    return {
      controller: {
        enqueue: vi.fn((chunk: any) => {
          enqueuedChunks.push(chunk);
        }),
        terminate: vi.fn(),
        error: vi.fn(),
      } as unknown as TransformStreamDefaultController<any>,
      enqueuedChunks,
    };
  }

  // Helper to create a mock abort function
  function createMockAbort() {
    return vi.fn((reason?: string) => {
      throw new Error(reason || 'Aborted');
    }) as any;
  }

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta' as const, id: 'text-1', delta: '{"color": "blue", "intensity": "bright"}' },
        ]),
      }),
    });

    processor = new StructuredOutputProcessor({
      schema: testSchema,
      model: mockModel,
      errorStrategy: 'strict',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processOutputStream', () => {
    it('should pass through non-finish chunks unchanged', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const textChunk = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'text-delta' as const,
        payload: { id: 'test-id', text: 'Hello' },
      };

      const result = await processor.processOutputStream({
        part: textChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      expect(result).toBe(textChunk);
      expect(controller.enqueue).not.toHaveBeenCalled();
    });

    it('should call abort with strict error strategy', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
          },
        ]),
      };

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await expect(
        processor.processOutputStream({
          part: finishChunk,
          streamParts: [],
          state: { controller },
          abort,
        }),
      ).rejects.toThrow();
    });

    it('should enqueue fallback value with fallback strategy', async () => {
      const fallbackProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'fallback',
        fallbackValue: { color: 'default', intensity: 'medium' },
      });

      const { controller, enqueuedChunks } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
          },
        ]),
      };

      vi.spyOn(fallbackProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await fallbackProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      expect(enqueuedChunks).toHaveLength(1);
      expect(enqueuedChunks[0].type).toBe('object-result');
      expect(enqueuedChunks[0].object).toEqual({ color: 'default', intensity: 'medium' });
      expect(enqueuedChunks[0].metadata.fallback).toBe(true);
    });

    it('should warn but not abort with warn strategy', async () => {
      const warnProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'warn',
      });

      const { controller } = createMockController();
      const abort = createMockAbort();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
          },
        ]),
      };

      vi.spyOn(warnProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await warnProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(abort).not.toHaveBeenCalled();
    });

    it('should only process once even if called multiple times', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'blue', intensity: 'bright' },
          },
        ]),
      };

      const streamSpy = vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      // Call processOutputStream twice with finish chunks
      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      // Should only call stream once (guarded by isStructuringAgentStreamStarted)
      expect(streamSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('prompt building', () => {
    it('should build prompt from different chunk types', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const streamParts: ChunkType[] = [
        // Text chunks
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: '1', text: 'User input' },
        },
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: '2', text: 'Agent response' },
        },
        // Tool call chunk
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'tool-call' as const,
          payload: {
            toolCallId: 'call-1',
            toolName: 'calculator',
            // @ts-expect-error - tool call chunk args are unknown
            args: { operation: 'add', a: 1, b: 2 },
            output: 3,
          },
        },
        // Tool result chunk
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'tool-result' as const,
          payload: {
            toolCallId: 'call-1',
            toolName: 'calculator',
            result: 3,
          },
        },
      ];

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      // Mock the structuring agent
      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'green', intensity: 'low', count: 5 },
          },
        ]),
      };

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await processor.processOutputStream({
        part: finishChunk,
        streamParts,
        state: { controller },
        abort,
      });

      // Check that the prompt was built correctly with all the different sections
      const call = (processor['structuringAgent'].stream as any).mock.calls[0];
      const prompt = call[0];

      expect(prompt).toContain('# Assistant Response');
      expect(prompt).toContain('User input');
      expect(prompt).toContain('Agent response');
      expect(prompt).toContain('# Tool Calls');
      expect(prompt).toContain('## calculator');
      expect(prompt).toContain('### Input:');
      expect(prompt).toContain('### Output:');
      expect(prompt).toContain('# Tool Results');
      expect(prompt).toContain('calculator:');
    });
  });

  describe('instruction generation', () => {
    it('should generate instructions based on schema', () => {
      const instructions = (processor as any).generateInstructions();

      expect(instructions).toContain('data structuring specialist');
      expect(instructions).toContain('JSON format');
      expect(instructions).toContain('Extract relevant information');
      expect(typeof instructions).toBe('string');
    });

    it('should use custom instructions if provided', async () => {
      const customInstructions = 'Custom structuring instructions';
      const customProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        instructions: customInstructions,
      });

      const agent = (customProcessor as unknown as { structuringAgent: Agent }).structuringAgent;
      // The custom instructions should be used instead of generated ones
      expect(await agent.getInstructions()).toBe(customInstructions);
    });
  });

  describe('integration scenarios', () => {
    it('should handle reasoning chunks', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const streamParts = [
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'reasoning-delta' as const,
          payload: { id: '1', text: 'I need to analyze the color and intensity' },
        },
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: '2', text: 'The answer is blue and bright' },
        },
      ];

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'blue', intensity: 'bright' },
          },
        ]),
      };

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await processor.processOutputStream({
        part: finishChunk,
        streamParts,
        state: { controller },
        abort,
      });

      // Check that the prompt includes reasoning
      const call = (processor['structuringAgent'].stream as any).mock.calls[0];
      const prompt = call[0];

      expect(prompt).toContain('# Assistant Reasoning');
      expect(prompt).toContain('I need to analyze the color and intensity');
      expect(prompt).toContain('# Assistant Response');
      expect(prompt).toContain('The answer is blue and bright');
    });
  });
});

describe('Structured Output with Tool Execution', () => {
  it('should generate structured output when tools are involved', async () => {
    // Test processor to track streamParts state
    const streamPartsLog: { type: string; streamPartsLength: number }[] = [];
    class StateTrackingProcessor implements Processor {
      id = 'state-tracking-processor';
      name = 'State Tracking Processor';
      async processOutputStream({ part, streamParts }: any) {
        streamPartsLog.push({ type: part.type, streamPartsLength: streamParts.length });
        console.log(`Processor saw ${part.type}, streamParts.length: ${streamParts.length}`);
        return part;
      }
    }

    // Define the structured output schema
    const responseSchema = z.object({
      toolUsed: z.string(),
      result: z.string(),
      confidence: z.number(),
    });

    // Mock tool that returns a result
    const mockTool = {
      description: 'A calculator tool',
      parameters: {
        type: 'object' as const,
        properties: {
          a: { type: 'number' as const },
          b: { type: 'number' as const },
        },
        required: ['a', 'b'] as const,
      },
      execute: vi.fn(async (input: { a: number; b: number }, _context: any) => {
        return { sum: input.a + input.b };
      }),
    };

    // Create mock model that calls a tool and returns structured output
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call or after tool execution
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // First LLM call - request tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-123',
                toolName: 'calculator',
                input: JSON.stringify({ a: 5, b: 3 }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        } else {
          // Second LLM call - after tool execution, return structured output
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{"toolUsed":"calculator","result":"8","confidence":0.95}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent with structured output and tools',
      model: mockModel as any,
      tools: {
        calculator: mockTool,
      },
      outputProcessors: [new StateTrackingProcessor()],
    });

    // Stream the response
    const stream = await agent.stream('Calculate 5 + 3 and return structured output', {
      format: 'aisdk',
      maxSteps: 5,
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'), // Use real model for structured output processor
      },
    });

    console.log('Stream properties:', Object.keys(stream));
    console.log('Has partialObjectStream?', 'partialObjectStream' in stream);
    console.log('Has object?', 'object' in stream);

    // Don't consume fullStream first - get the object while consuming
    const fullStreamChunks: any[] = [];

    // Consume full stream and wait for object in parallel
    const [chunks, finalObject] = await Promise.all([
      (async () => {
        const collected: any[] = [];
        for await (const chunk of stream.fullStream) {
          collected.push(chunk);
          console.log('Chunk:', chunk.type, chunk.type === 'finish' ? chunk : '');
        }
        return collected;
      })(),
      stream.object,
    ]);

    fullStreamChunks.push(...chunks);

    console.log(
      'Full stream chunk types:',
      fullStreamChunks.map(c => c.type),
    );
    console.log(
      'Finish chunks:',
      fullStreamChunks.filter(c => c.type === 'finish'),
    );
    console.log(
      'Tool result chunk:',
      fullStreamChunks.find(c => c.type === 'tool-result'),
    );
    console.log('Mock tool execute called times:', mockTool.execute.mock.calls.length);
    console.log('Final object:', finalObject);

    // ISSUE: Before the fix, no structured output would be generated when tools are involved
    // The structured output processor would lose state between LLM calls or not trigger at all

    // Verify the final object matches the schema
    expect(finalObject).toBeDefined();
    expect(finalObject.toolUsed).toBe('calculator');
    expect(finalObject.result).toBe('8');
    expect(typeof finalObject.confidence).toBe('number');

    // Verify the tool was actually executed
    expect(fullStreamChunks.find(c => c.type === 'tool-result')).toBeDefined();
  });

  it('should handle structured output with multiple tool calls', async () => {
    const responseSchema = z.object({
      activities: z.array(z.string()),
      toolsCalled: z.array(z.string()),
      location: z.string(),
    });

    const weatherTool = createTool({
      id: 'weather-tool',
      description: 'Get weather for a location',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async (inputData, _context) => {
        const { location } = inputData;
        return {
          temperature: 70,
          feelsLike: 65,
          humidity: 50,
          windSpeed: 10,
          windGust: 15,
          conditions: 'sunny',
          location,
        };
      },
    });

    const planActivities = createTool({
      id: 'plan-activities',
      description: 'Plan activities based on the weather',
      inputSchema: z.object({
        temperature: z.string(),
      }),
      execute: async () => {
        return { activities: 'Plan activities based on the weather' };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions:
        'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool. Every tool call you make IMMEDIATELY explain the tool results after executing the tool, before moving on to other steps or tool calls',
      model: openai('gpt-4o-mini'),
      tools: {
        weatherTool,
        planActivities,
      },
    });

    const stream = await agent.stream('What is the weather in Toronto?', {
      format: 'aisdk',
      maxSteps: 10,
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'), // Use real model for structured output processor
      },
    });

    // Consume the stream
    for await (const chunk of stream.fullStream) {
      console.log('Chunk:', chunk.type);
      // Just consume
    }

    const finalObject = await stream.object;
    console.log('Final object with multiple tools:', finalObject);

    // Verify the structured output was generated correctly
    expect(finalObject).toBeDefined();
    expect(finalObject.activities.length).toBeGreaterThanOrEqual(1);
    expect(finalObject.toolsCalled).toHaveLength(2);
    expect(finalObject.location).toBe('Toronto');
  }, 15000);

  it('should NOT use structured output processor when model is not provided', async () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant. Respond with JSON matching the required schema.',
      model: openai('gpt-4o-mini'),
    });

    const result = await agent.generate('What is 2+2?', {
      structuredOutput: {
        schema: responseSchema,
        // Note: no model provided - should use response_format or JSON prompt injection
      },
    });

    // Verify the result has the expected structure
    expect(result.object).toBeDefined();
    expect(result.object.answer).toBeDefined();
    expect(typeof result.object.confidence).toBe('number');
    expect(typeof result.object.answer).toBe('string');
  }, 15000);

  it('should add structuredOutput object to response message metadata', async () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant. Answer the question.',
      model: openai('gpt-4o-mini'),
    });

    const stream = await agent.stream('What is 2+2?', {
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'),
      },
    });

    // Consume the stream
    const result = await stream.getFullOutput();

    // Verify the structured output is available on the result
    expect(result.object).toBeDefined();
    expect(result.object.answer).toBeDefined();
    expect(typeof result.object.confidence).toBe('number');

    // Check that the structured output is in response message metadata (untyped v2 format)
    const responseMessages = stream.messageList.get.response.db();
    const lastAssistantMessage = [...responseMessages].reverse().find(m => m.role === 'assistant');

    expect(lastAssistantMessage).toBeDefined();
    expect(lastAssistantMessage?.content.metadata).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.structuredOutput).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.structuredOutput).toEqual(result.object);

    // Note: For typed metadata access, use result.response.uiMessages instead (see below)

    // UIMessages from response have properly typed metadata with structuredOutput
    const uiMessages = (await stream.response).uiMessages;
    const lastAssistantUIMessage = uiMessages!.find(m => m.role === 'assistant');

    expect(lastAssistantUIMessage).toBeDefined();
    expect(lastAssistantUIMessage?.metadata).toBeDefined();
    expect(lastAssistantUIMessage?.metadata?.structuredOutput).toBeDefined();
    expect(lastAssistantUIMessage?.metadata?.structuredOutput).toEqual(result.object);
  }, 15000);
});
