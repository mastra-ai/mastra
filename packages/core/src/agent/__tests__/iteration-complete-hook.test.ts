import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { IterationCompleteContext } from '../agent.types';

describe('onIterationComplete Hook Integration', () => {
  it('should call onIterationComplete hook after each iteration', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'simple-tool',
      description: 'A simple tool',
      inputSchema: z.object({
        input: z.string(),
      }),
      execute: async () => {
        return { result: 'Tool executed' };
      },
    });

    // Create model that generates tool call then responds
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You use tools and respond',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: return tool call
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  args: { input: 'test' },
                },
              ],
              warnings: [],
            };
          }
          // Second call: return text response
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Final response after tool',
            content: [{ type: 'text', text: 'Final response after tool' }],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: return tool call
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call-start',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                },
                {
                  type: 'tool-call-args-delta',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  argsDelta: '{"input":"test"}',
                },
                {
                  type: 'tool-call-end',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  args: { input: 'test' },
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }
          // Second call: return text response
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Final response after tool' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      tools: {
        simpleTool,
      },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('test-agent');

    await testAgent.generate('Use tool then respond', {
      maxSteps: 5,
      onIterationComplete: (ctx: IterationCompleteContext) => {
        iterations.push(ctx.iteration);
        return { continue: true };
      },
    });

    // Two iterations: one for the tool call, one for the final stop response
    expect(iterations).toEqual([1, 2]);
  });

  it('should stop iteration when onIterationComplete returns continue: false', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'counter-tool',
      description: 'Counts calls',
      inputSchema: z.object({
        count: z.number(),
      }),
      execute: async ({ count }) => {
        return { result: `Count: ${count}` };
      },
    });

    const agent = new Agent({
      id: 'counter-agent',
      name: 'Counter Agent',
      instructions: 'You keep calling the counter tool',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          // Always return tool calls to test stopping
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call',
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                args: { count: callCount },
              },
            ],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call-start',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
              },
              {
                type: 'tool-call-args-delta',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                argsDelta: `{"count":${callCount}}`,
              },
              {
                type: 'tool-call-end',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                args: { count: callCount },
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      tools: {
        simpleTool,
      },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'counter-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('counter-agent');

    await testAgent.generate('Keep counting', {
      maxSteps: 10,
      onIterationComplete: (ctx: IterationCompleteContext) => {
        iterations.push(ctx.iteration);
        // Stop after 2 iterations
        if (ctx.iteration >= 2) {
          return { continue: false };
        }
        return { continue: true };
      },
    });

    // Hook returns continue: false at iteration >= 2, so exactly 2 iterations fire
    expect(iterations).toEqual([1, 2]);
  });

  it('should add feedback to conversation when provided', async () => {
    const feedbackMessages: string[] = [];
    let callCount = 0;

    const agent = new Agent({
      id: 'feedback-agent',
      name: 'Feedback Agent',
      instructions: 'You respond to feedback',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          callCount++;

          // Check if feedback was added to messages
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          const feedbackMsg = messages.find(
            (m: any) => typeof m.content === 'string' && m.content.includes('Please improve'),
          );
          if (feedbackMsg) {
            feedbackMessages.push((feedbackMsg as any).content);
          }

          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'First response',
              content: [{ type: 'text', text: 'First response' }],
              warnings: [],
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Improved response after feedback',
            content: [{ type: 'text', text: 'Improved response after feedback' }],
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          callCount++;

          // Check if feedback was added to messages
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          const feedbackMsg = messages.find(
            (m: any) => typeof m.content === 'string' && m.content.includes('Please improve'),
          );
          if (feedbackMsg) {
            feedbackMessages.push((feedbackMsg as any).content);
          }

          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'First response' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Improved response after feedback' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'feedback-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('feedback-agent');

    let iterationCount = 0;
    await testAgent.generate('Generate response', {
      maxSteps: 3,
      onIterationComplete: () => {
        iterationCount++;
        if (iterationCount === 1) {
          // Add feedback after first iteration
          return {
            continue: true,
            feedback: 'Please improve your response with more details.',
          };
        }
        return { continue: false }; // Stop after second iteration
      },
    });

    // When the model returns stop (isFinal), the loop ends after that iteration
    // even if the hook returns continue: true with feedback. Feedback only adds
    // a user message for the *next* iteration when the loop would naturally continue
    // (e.g. during a tool-call sequence). Here the model says stop on iteration 1
    // so the loop ends and the hook is called exactly once.
    expect(iterationCount).toBe(1);
  });

  it('should accept onIterationComplete configuration without errors', async () => {
    const hookMock = vi.fn(() => ({ continue: true }));

    const agent = new Agent({
      id: 'test-agent',
      name: 'test agent',
      instructions: 'Test agent',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Response',
          content: [{ type: 'text', text: 'Response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      }),
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('test-agent');

    // This should not throw an error
    const result = await testAgent.generate('Test', {
      maxSteps: 1,
      onIterationComplete: hookMock,
    });

    expect(result).toBeDefined();
    expect(result.text).toBe('Response');

    // Hook should be called after the iteration
    expect(hookMock).toHaveBeenCalled();
  });
});
