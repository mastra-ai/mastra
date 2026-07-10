import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createTool } from '../tools';
import type { Processor } from './index';

describe('Output Processor Tool Result Chunks', () => {
  it('should receive tool-result chunks in processOutputStream', async () => {
    const capturedChunkTypes: string[] = [];

    class ToolResultTrackingProcessor implements Processor {
      readonly id = 'tool-result-tracking-processor';
      readonly name = 'Tool Result Tracking Processor';

      async processOutputStream({ part }: any) {
        capturedChunkTypes.push(part.type);
        return part;
      }
    }

    // Create a real tool using createTool
    const echoTool = createTool({
      id: 'echoTool',
      description: 'A test tool that echoes input',
      inputSchema: z.object({
        text: z.string(),
      }),
      execute: async inputData => {
        return `Echo: ${inputData.text}`;
      },
    });

    // Create mock model that calls a tool
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call (no tool results in messages) or second call (after tool execution)
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
                toolCallId: 'call-456',
                toolName: 'echoTool',
                input: JSON.stringify({ text: 'hello' }),
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
          // Second LLM call - after tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'The tool returned: Echo: hello' },
              { type: 'text-end', id: 'text-1' },
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
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        echoTool,
      },
      outputProcessors: [new ToolResultTrackingProcessor()],
    });

    const stream = await agent.stream('Call the echo tool with text "hello"', {
      maxSteps: 5,
    });

    // Consume the stream and verify tool-result appears in fullStream
    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    // Verify the stream contains tool-result (proving the tool was executed)
    expect(streamChunkTypes).toContain('tool-result');

    // The key assertion: processOutputStream should have received 'tool-result' chunks
    // This is the bug - currently tool-result chunks bypass output processors
    expect(capturedChunkTypes).toContain('tool-result');
  });

  it('should receive step lifecycle chunks in processOutputStream', async () => {
    const capturedChunkTypes: string[] = [];

    class StepLifecycleTrackingProcessor implements Processor {
      readonly id = 'step-lifecycle-tracking-processor';
      readonly name = 'Step Lifecycle Tracking Processor';

      async processOutputStream({ part }: any) {
        capturedChunkTypes.push(part.type);
        return part;
      }
    }

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'hello' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [new StepLifecycleTrackingProcessor()],
    });

    const stream = await agent.stream('Say hello');

    const streamChunkTypes: string[] = [];
    for await (const chunk of stream.fullStream) {
      streamChunkTypes.push(chunk.type);
    }

    expect(streamChunkTypes).toContain('step-start');
    expect(streamChunkTypes).toContain('step-finish');
    expect(capturedChunkTypes).toContain('step-start');
    expect(capturedChunkTypes).toContain('step-finish');
  });
});

describe('Output Processor State Persistence Across Tool Execution', () => {
  it('should filter intermediate finish chunks and maintain state during tool execution', async () => {
    const capturedChunks: { type: string; accumulatedTypes: string[] }[] = [];
    class StateTrackingProcessor implements Processor {
      readonly id = 'state-tracking-processor';
      readonly name = 'State Tracking Processor';

      async processOutputStream({ part, streamParts }: any) {
        capturedChunks.push({
          type: part.type,
          accumulatedTypes: streamParts.map((p: any) => p.type),
        });
        return part;
      }
    }

    // Mock tool that returns a result
    const mockTool = {
      description: 'A test tool',
      parameters: {
        type: 'object' as const,
        properties: {
          input: { type: 'string' as const },
        },
        required: ['input'] as const,
      },
      execute: vi.fn(async () => {
        return { result: 'tool executed successfully' };
      }),
    };

    // Create mock model that calls a tool
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call (no tool results in messages) or second call (after tool execution)
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
                toolName: 'testTool',
                input: JSON.stringify({ input: 'test' }),
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
          // Second LLM call - after tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'The tool executed successfully!' },
              { type: 'text-end', id: 'text-1' },
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
      name: 'Test Agent',
      instructions: 'Test agent with tools',
      model: mockModel as any,
      tools: {
        testTool: mockTool,
      },
      outputProcessors: [new StateTrackingProcessor()],
    });

    const stream = await agent.stream('Execute the test tool', {
      maxSteps: 5,
    });

    const fullStreamChunks: any[] = [];
    for await (const chunk of stream.fullStream) {
      fullStreamChunks.push(chunk);
    }

    const finishChunks = capturedChunks.filter(c => c.type === 'finish');
    // Output stream processor should just receive the final finish chunk
    expect(finishChunks.length).toBe(1);

    const toolCallIndex = capturedChunks.findIndex(c => c.type === 'tool-call');
    expect(toolCallIndex).toBe(2); // Should follow step-start and response-metadata

    // Verify state accumulation works
    expect(capturedChunks[0]!.type).toBe('step-start');
    expect(capturedChunks[0]!.accumulatedTypes).toEqual(['step-start']);

    expect(capturedChunks[1]!.type).toBe('response-metadata');
    expect(capturedChunks[1]!.accumulatedTypes).toEqual(['step-start', 'response-metadata']);

    expect(capturedChunks[2]!.type).toBe('tool-call');
    expect(capturedChunks[2]!.accumulatedTypes).toEqual(['step-start', 'response-metadata', 'tool-call']);
  });
});

describe('processToolResult lifecycle hook', () => {
  // Helper that builds a mock model which calls a single tool then finishes.
  // First call requests the tool, second call (after tool result is fed back) emits final text.
  const makeMockToolCallModel = (toolName: string, toolCallId = 'call-tr-1', toolInput = { text: 'hello' }) =>
    new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId,
                toolName,
                input: JSON.stringify(toolInput),
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
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'done' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

  it('fires once per tool result with correct toolName, toolCallId, args, and result', async () => {
    const calls: Array<{ toolName: string; toolCallId: string; args: unknown; result: unknown }> = [];

    class CapturingProcessor implements Processor {
      readonly id = 'capturing';
      async processToolResult({ toolName, toolCallId, args, result }: any) {
        calls.push({ toolName, toolCallId, args, result });
      }
    }

    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => `Echo: ${text}`,
    });

    const agent = new Agent({
      id: 'tr-agent-1',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      outputProcessors: [new CapturingProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    for await (const _ of stream.fullStream) {
      void _;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]!.toolName).toBe('echoTool');
    expect(calls[0]!.toolCallId).toBe('call-tr-1');
    expect(calls[0]!.args).toEqual({ text: 'hello' });
    expect(calls[0]!.result).toBe('Echo: hello');
  });

  it('mutating messageList.updateToolInvocation replaces the result before downstream', async () => {
    class RedactingProcessor implements Processor {
      readonly id = 'redacting';
      async processToolResult({ messageList, toolCallId, toolName, args }: any) {
        messageList.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId,
            toolName,
            args,
            result: '[REDACTED]',
          },
        });
      }
    }

    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => `Echo: ${text}`,
    });

    const agent = new Agent({
      id: 'tr-agent-2',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      outputProcessors: [new RedactingProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    let toolResultChunkValue: unknown;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        toolResultChunkValue = (chunk as any).payload?.result ?? (chunk as any).result;
      }
    }

    // Streaming clients see the redacted value, not the raw tool return
    expect(toolResultChunkValue).toBe('[REDACTED]');
  });

  it('abort() halts the run with the processor reason', async () => {
    class BlockingProcessor implements Processor {
      readonly id = 'blocking';
      async processToolResult({ abort }: any) {
        abort('blocked by tool-result-guard');
      }
    }

    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => `Echo: ${text}`,
    });

    const agent = new Agent({
      id: 'tr-agent-3',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      outputProcessors: [new BlockingProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    let sawTripwire = false;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tripwire') {
        sawTripwire = true;
      }
    }

    expect(sawTripwire).toBe(true);
  });

  it('persists per-processor state across multiple tool results in one generation', async () => {
    const seenStates: Array<Record<string, unknown>> = [];

    class StatefulProcessor implements Processor {
      readonly id = 'stateful';
      async processToolResult({ state }: any) {
        state.calls = (state.calls as number | undefined) ?? 0;
        (state as any).calls += 1;
        seenStates.push({ ...state });
      }
    }

    // Mock model that calls the tool TWICE (so processToolResult fires twice in one run)
    const mockModelTwoCalls = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const toolResultCount = prompt.reduce((acc: number, msg: any) => {
          if (msg.role === 'tool') return acc + 1;
          if (Array.isArray(msg.content)) {
            return acc + msg.content.filter((c: any) => c.type === 'tool-result').length;
          }
          return acc;
        }, 0);

        if (toolResultCount === 0) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-a', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-a',
                toolName: 'echoTool',
                input: JSON.stringify({ text: 'a' }),
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
        }
        if (toolResultCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-b', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-b',
                toolName: 'echoTool',
                input: JSON.stringify({ text: 'b' }),
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
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-c', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => `Echo: ${text}`,
    });

    const agent = new Agent({
      id: 'tr-agent-4',
      name: 'Test Agent',
      instructions: 'tr',
      model: mockModelTwoCalls as any,
      tools: { echoTool },
      outputProcessors: [new StatefulProcessor()],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    for await (const _ of stream.fullStream) {
      void _;
    }

    expect(seenStates).toHaveLength(2);
    expect(seenStates[0]!.calls).toBe(1);
    expect(seenStates[1]!.calls).toBe(2);
  });

  it('does not fire when the processor is registered but does not implement processToolResult', async () => {
    let outputStreamChunks = 0;

    class StreamOnlyProcessor implements Processor {
      readonly id = 'stream-only';
      async processOutputStream({ part }: any) {
        outputStreamChunks++;
        return part;
      }
    }

    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => `Echo: ${text}`,
    });

    const agent = new Agent({
      id: 'tr-agent-5',
      name: 'Test Agent',
      instructions: 'tr',
      model: makeMockToolCallModel('echoTool') as any,
      tools: { echoTool },
      outputProcessors: [new StreamOnlyProcessor()],
    });

    // No assertion on processToolResult — just confirm the stream completes
    // without errors when only processOutputStream is implemented.
    const stream = await agent.stream('go', { maxSteps: 5 });
    for await (const _ of stream.fullStream) {
      void _;
    }
    expect(outputStreamChunks).toBeGreaterThan(0);
  });
});
