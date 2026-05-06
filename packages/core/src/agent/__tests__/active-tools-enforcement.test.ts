import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { getToolGateRuntimeState } from '../../tools/tool-gate';
import { Agent } from '../agent';

/**
 * Tests that activeTools filtering is enforced at tool execution time,
 * not just at the model prompt level. This prevents models from executing
 * tools they shouldn't have access to (e.g. from conversation history).
 */
describe('activeTools enforcement at execution time', () => {
  it('rejects tool calls for tools not in activeTools', async () => {
    const allowedExecute = vi.fn().mockResolvedValue('allowed result');
    const hiddenExecute = vi.fn().mockResolvedValue('hidden result');

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          // Model calls a tool that is NOT in activeTools
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'hiddenTool',
                input: JSON.stringify({ value: 'test' }),
              },
            ],
            warnings: [],
          };
        }
        // Second call: model gives up and returns text
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        allowedTool: createTool({
          id: 'allowedTool',
          description: 'An allowed tool',
          inputSchema: z.object({ value: z.string() }),
          execute: allowedExecute,
        }),
        hiddenTool: createTool({
          id: 'hiddenTool',
          description: 'A hidden tool',
          inputSchema: z.object({ value: z.string() }),
          execute: hiddenExecute,
        }),
      },
    });

    const result = await agent.generate('Hello', {
      maxSteps: 3,
      prepareStep: () => ({
        activeTools: ['allowedTool'],
      }),
    });

    // The hidden tool should NOT have been executed
    expect(hiddenExecute).not.toHaveBeenCalled();

    // Model was called twice: first with hidden tool call (rejected), then text response
    expect(callCount).toBe(2);
    expect(result.text).toBe('Done.');
  });

  it('allows tool calls for tools in activeTools', async () => {
    const allowedExecute = vi.fn().mockResolvedValue('allowed result');

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'allowedTool',
                input: JSON.stringify({ value: 'test' }),
              },
            ],
            warnings: [],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        allowedTool: createTool({
          id: 'allowedTool',
          description: 'An allowed tool',
          inputSchema: z.object({ value: z.string() }),
          execute: allowedExecute,
        }),
        hiddenTool: createTool({
          id: 'hiddenTool',
          description: 'A hidden tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn().mockResolvedValue('hidden result'),
        }),
      },
    });

    await agent.generate('Hello', {
      maxSteps: 3,
      prepareStep: () => ({
        activeTools: ['allowedTool'],
      }),
    });

    // The allowed tool should have been executed
    expect(allowedExecute).toHaveBeenCalledOnce();
  });

  it('does not restrict tools when activeTools is not set', async () => {
    const tool1Execute = vi.fn().mockResolvedValue('result1');
    const tool2Execute = vi.fn().mockResolvedValue('result2');

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: JSON.stringify({ value: 'test' }),
              },
              {
                type: 'tool-call' as const,
                toolCallId: 'call-2',
                toolName: 'tool2',
                input: JSON.stringify({ value: 'test' }),
              },
            ],
            warnings: [],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        tool1: createTool({
          id: 'tool1',
          description: 'Tool 1',
          inputSchema: z.object({ value: z.string() }),
          execute: tool1Execute,
        }),
        tool2: createTool({
          id: 'tool2',
          description: 'Tool 2',
          inputSchema: z.object({ value: z.string() }),
          execute: tool2Execute,
        }),
      },
    });

    // No prepareStep = no activeTools restriction
    await agent.generate('Hello', { maxSteps: 3 });

    expect(tool1Execute).toHaveBeenCalledOnce();
    expect(tool2Execute).toHaveBeenCalledOnce();
  });

  it('filters denied tool gate tools after prepareStep before calling the model', async () => {
    const requestContext = new RequestContext();
    const seenModelTools: string[][] = [];

    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ tools }: any) => {
        seenModelTools.push(Array.isArray(tools) ? tools.map(tool => tool.name) : Object.keys(tools ?? {}));

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        allowedTool: createTool({
          id: 'allowedTool',
          description: 'An allowed tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn(),
        }),
        hiddenTool: createTool({
          id: 'hiddenTool',
          description: 'A denied tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn(),
        }),
      },
    });

    await agent.generate('Hello', {
      requestContext,
      maxSteps: 1,
      prepareStep: ({ tools }) => ({
        tools,
        activeTools: ['allowedTool', 'hiddenTool'],
      }),
      toolGatePolicy: {
        id: 'test-tool-gate',
        evaluate: ({ subject }) =>
          subject.toolName === 'hiddenTool'
            ? { effect: 'deny', reason: 'hidden tool is disabled' }
            : { effect: 'allow', reason: 'tool is allowed' },
      },
    });

    expect(seenModelTools[0]).toContain('allowedTool');
    expect(seenModelTools[0]).not.toContain('hiddenTool');
    expect(getToolGateRuntimeState(requestContext)?.decisions).toEqual([
      expect.objectContaining({
        effect: 'allow',
        subject: expect.objectContaining({ boundary: 'model-input', toolName: 'allowedTool' }),
      }),
      expect.objectContaining({
        effect: 'deny',
        subject: expect.objectContaining({ boundary: 'model-input', toolName: 'hiddenTool' }),
      }),
    ]);
  });

  it('hides provider-executed tools that require local approval before calling the model', async () => {
    const seenModelTools: string[][] = [];

    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ tools }: any) => {
        seenModelTools.push(Array.isArray(tools) ? tools.map(tool => tool.name) : Object.keys(tools ?? {}));

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        localTool: createTool({
          id: 'localTool',
          description: 'A local tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn(),
        }),
        webSearch: {
          type: 'provider-defined',
          id: 'openai.web_search',
          name: 'web_search',
          args: { search_context_size: 'low' },
        } as any,
      },
    });

    await agent.generate('Hello', {
      maxSteps: 1,
      toolGatePolicy: {
        id: 'provider-approval-policy',
        evaluate: ({ subject }) =>
          subject.toolName === 'webSearch'
            ? { effect: 'requireApproval', reason: 'provider approval is local only' }
            : { effect: 'allow', reason: 'tool is allowed' },
      },
    });

    expect(seenModelTools[0]).toContain('localTool');
    expect(seenModelTools[0]).not.toContain('webSearch');
  });

  it('does not reuse a call-site tool gate policy on later calls with the same requestContext', async () => {
    const requestContext = new RequestContext();
    const seenModelTools: string[][] = [];

    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ tools }: any) => {
        seenModelTools.push(Array.isArray(tools) ? tools.map(tool => tool.name) : Object.keys(tools ?? {}));

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        allowedTool: createTool({
          id: 'allowedTool',
          description: 'An allowed tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn(),
        }),
        hiddenTool: createTool({
          id: 'hiddenTool',
          description: 'A denied tool',
          inputSchema: z.object({ value: z.string() }),
          execute: vi.fn(),
        }),
      },
    });

    const prepareStep = ({ tools }: any) => ({
      tools,
      activeTools: ['allowedTool', 'hiddenTool'],
    });

    await agent.generate('Hello', {
      requestContext,
      maxSteps: 1,
      prepareStep,
      toolGatePolicy: {
        id: 'test-tool-gate',
        evaluate: ({ subject }) =>
          subject.toolName === 'hiddenTool'
            ? { effect: 'deny', reason: 'hidden tool is disabled' }
            : { effect: 'allow', reason: 'tool is allowed' },
      },
    });

    await agent.generate('Hello again', {
      requestContext,
      maxSteps: 1,
      prepareStep,
    });

    expect(seenModelTools[0]).toContain('allowedTool');
    expect(seenModelTools[0]).not.toContain('hiddenTool');
    expect(seenModelTools[1]).toContain('allowedTool');
    expect(seenModelTools[1]).toContain('hiddenTool');
    expect(getToolGateRuntimeState(requestContext)?.policy).toBeUndefined();
  });

  it('does not run streaming input hooks before a tool-call policy decision', async () => {
    const onInputStart = vi.fn();
    const onInputDelta = vi.fn();
    const onInputAvailable = vi.fn();

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'response-id', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'tool-input-start', id: 'gate-call-id', toolName: 'gateTool' },
          { type: 'tool-input-delta', id: 'gate-call-id', delta: '{"action"' },
          { type: 'tool-input-delta', id: 'gate-call-id', delta: ':"send"}' },
          { type: 'tool-input-end', id: 'gate-call-id' },
          {
            type: 'tool-call',
            toolCallId: 'gate-call-id',
            toolName: 'gateTool',
            input: '{"action":"send"}',
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        gateTool: createTool({
          id: 'gateTool',
          description: 'A gated tool',
          inputSchema: z.object({ action: z.string() }),
          execute: vi.fn(),
          onInputStart,
          onInputDelta,
          onInputAvailable,
        }),
      },
    });

    const stream = await agent.stream('Hello', {
      maxSteps: 1,
      toolGatePolicy: {
        id: 'approval-policy',
        evaluate: ({ subject }) =>
          subject.boundary === 'tool-call'
            ? { effect: 'requireApproval', reason: 'external write' }
            : { effect: 'allow', reason: 'model disclosure allowed' },
      },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') break;
    }

    expect(onInputStart).not.toHaveBeenCalled();
    expect(onInputDelta).not.toHaveBeenCalled();
    expect(onInputAvailable).not.toHaveBeenCalled();
  });
});
