import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Tool choice scenario.
 *
 * Tests different toolChoice configurations that control how the model uses tools:
 * - 'auto': Model decides whether to call tools (default)
 * - 'required': Model must call at least one tool
 * - 'none': Model cannot call tools
 * - { type: 'tool', toolName: 'specific-tool' }: Model must call specific tool
 */
describeForAllEngines('AIMock scenario: tool choice', engine => {
  const getMock = useLoopScenarioAimock();

  it('should respect toolChoice: none and not call tools', async () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: input }),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: { 'test-tool': tool },
      toolChoice: 'none',
      stopWhen: stepCountIs(1),
      collectChunks: true,
      fixtures: llm => {
        // With toolChoice: 'none', model should only return text
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Hello! How can I help you?' });
      },
    });

    const text = await output.text;
    expect(text).toBe('Hello! How can I help you?');

    // Verify no tool calls were made
    const toolCallChunks = chunks?.filter(chunk => chunk.type === 'tool-call') || [];
    expect(toolCallChunks).toHaveLength(0);

    // When toolChoice is 'none', the provider may or may not send the field
    // The important behavior is that no tools are called (verified above)
  });

  it('should respect toolChoice: required and force tool call', async () => {
    const tool = createTool({
      id: 'required-tool',
      description: 'A required tool',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ result: `Processed: ${query}` }),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Process this',
      tools: { 'required-tool': tool },
      toolChoice: 'required',
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        // With toolChoice: 'required', model must call a tool
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call-1',
                name: 'required-tool',
                arguments: { query: 'this' },
              },
            ],
          },
        );

        llm.on({ endpoint: 'chat', toolCallId: 'call-1', hasToolResult: true }, { content: 'Processing complete' });
      },
    });

    const text = await output.text;
    expect(text).toBe('Processing complete');

    // Verify tool was called
    const toolCallChunks = chunks?.filter(chunk => chunk.type === 'tool-call') || [];
    expect(toolCallChunks).toHaveLength(1);
    expect((toolCallChunks[0].payload as any).toolName).toBe('required-tool');

    // Verify tool_choice was passed in request
    const firstRequest = requests[0];
    expect(firstRequest?.body?.tool_choice).toBe('required');
  });

  it('should respect toolChoice with specific tool name', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `tool1: ${input}` }),
    });

    const tool2 = createTool({
      id: 'tool-2',
      description: 'Second tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `tool2: ${input}` }),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use a tool',
      tools: { 'tool-1': tool1, 'tool-2': tool2 },
      toolChoice: { type: 'tool', toolName: 'tool-2' },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        // Force model to call tool-2 specifically
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call-1',
                name: 'tool-2',
                arguments: { input: 'test' },
              },
            ],
          },
        );

        llm.on({ endpoint: 'chat', toolCallId: 'call-1', hasToolResult: true }, { content: 'Used tool-2' });
      },
    });

    const text = await output.text;
    expect(text).toBe('Used tool-2');

    // Verify only tool-2 was called
    const toolCallChunks = chunks?.filter(chunk => chunk.type === 'tool-call') || [];
    expect(toolCallChunks).toHaveLength(1);
    expect((toolCallChunks[0].payload as any).toolName).toBe('tool-2');

    // Verify tool_choice was passed in request
    const firstRequest = requests[0];
    // OpenAI provider sends { type: 'function', name: 'tool-2' } for specific tool choice
    expect(firstRequest?.body?.tool_choice).toEqual({
      type: 'function',
      name: 'tool-2',
    });
  });

  it('should default to toolChoice: auto when not specified', async () => {
    const tool = createTool({
      id: 'auto-tool',
      description: 'A tool for auto mode',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: input }),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Just say hello',
      tools: { 'auto-tool': tool },
      // Not specifying toolChoice - should default to 'auto'
      stopWhen: stepCountIs(1),
      collectChunks: true,
      fixtures: llm => {
        // With auto mode, model can choose whether to call tools
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Hello!' });
      },
    });

    const text = await output.text;
    expect(text).toBe('Hello!');

    // Model chose not to call any tools
    const toolCallChunks = chunks?.filter(chunk => chunk.type === 'tool-call') || [];
    expect(toolCallChunks).toHaveLength(0);

    // Verify tool_choice defaults to 'auto'
    const request = requests[0];
    expect(request?.body?.tool_choice).toBe('auto');
  });
});
