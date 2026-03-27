import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
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
});
