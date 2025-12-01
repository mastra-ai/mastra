/**
 * Test for GitHub Issue #9909
 *
 * [BUG] Agent streaming: Text deltas lost and incorrect message ordering when persisting to storage
 *
 * When using agent.stream() with Mastra's storage integration, the persisted messages
 * in the database have two critical issues:
 * 1. Missing text content: Initial text-delta chunks before tool calls are lost during persistence.
 * 2. Incorrect ordering: Text content that appears after tool execution during streaming is
 *    incorrectly placed before tool invocations in the stored message.
 *
 * This test verifies that:
 * - All text parts are preserved (no missing text)
 * - The order of text parts relative to tool calls is maintained
 * - The order is preserved after persistence and retrieval from storage
 */
import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { config } from 'dotenv';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

config();

describe('GitHub Issue #9909 - Text and tool call ordering', () => {
  let mockMemory: MockMemory;

  beforeEach(() => {
    mockMemory = new MockMemory();
  });

  it('should preserve text parts before and after tool calls in correct order', async () => {
    const searchTool = createTool({
      id: 'web_search',
      description: 'Search the web for information',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async input => {
        return `Search results for: ${input.query}`;
      },
    });

    const createBomTool = createTool({
      id: 'createBom',
      description: 'Create a bill of materials',
      inputSchema: z.object({
        items: z.array(z.string()).describe('List of items'),
      }),
      execute: async input => {
        return { success: true, items: input.items };
      },
    });

    // Create a mock model that simulates the exact streaming pattern from the issue:
    // 1. Text: "I'll create a bill of materials..."
    // 2. Tool calls: web_search (multiple invocations)
    // 3. Text: "Based on the market research, I now have..."
    // 4. Tool call: createBom
    // 5. Text: "Perfect! I've created a comprehensive bill..."
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'test-response', modelId: 'test-model', timestamp: new Date() },

          // Step 1: First text section (ID "0")
          { type: 'text-start', id: '0' },
          { type: 'text-delta', id: '0', delta: "I'll create " },
          { type: 'text-delta', id: '0', delta: 'a bill of materials ' },
          { type: 'text-delta', id: '0', delta: 'for 1000 liters of organic orange juice.' },
          { type: 'text-end', id: '0' },

          // Step 2: Tool calls (web_search)
          {
            type: 'tool-input-start',
            id: 'search-1',
            toolName: 'web_search',
          },
          {
            type: 'tool-input-delta',
            id: 'search-1',
            delta: '{"query":"organic orange prices Italy"}',
          },
          { type: 'tool-input-end', id: 'search-1' },
          {
            type: 'tool-call',
            toolCallId: 'search-1',
            toolName: 'web_search',
            input: '{"query":"organic orange prices Italy"}',
          },
          {
            type: 'tool-result',
            toolCallId: 'search-1',
            toolName: 'web_search',
            result: 'Search results for: organic orange prices Italy',
          },

          // Step 3: Second text section (ID "7")
          { type: 'text-start', id: '7' },
          { type: 'text-delta', id: '7', delta: 'Based on the market research, ' },
          { type: 'text-delta', id: '7', delta: 'I now have the information needed. ' },
          { type: 'text-delta', id: '7', delta: "Now I'll create the bill of materials." },
          { type: 'text-end', id: '7' },

          // Step 4: Second tool call (createBom)
          {
            type: 'tool-input-start',
            id: 'bom-1',
            toolName: 'createBom',
          },
          {
            type: 'tool-input-delta',
            id: 'bom-1',
            delta: '{"items":["oranges","sugar","packaging"]}',
          },
          { type: 'tool-input-end', id: 'bom-1' },
          {
            type: 'tool-call',
            toolCallId: 'bom-1',
            toolName: 'createBom',
            input: '{"items":["oranges","sugar","packaging"]}',
          },
          {
            type: 'tool-result',
            toolCallId: 'bom-1',
            toolName: 'createBom',
            result: { success: true, items: ['oranges', 'sugar', 'packaging'] },
          },

          // Step 5: Final text section (ID "12")
          { type: 'text-start', id: '12' },
          { type: 'text-delta', id: '12', delta: "Perfect! I've created " },
          { type: 'text-delta', id: '12', delta: 'a comprehensive bill of materials.' },
          { type: 'text-end', id: '12' },

          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const threadId = 'test-thread-ordering';
    const resourceId = 'test-resource-ordering';

    const agent = new Agent({
      id: 'test-ordering-agent',
      name: 'Test Ordering Agent',
      model: mockModel,
      instructions: 'You are a helpful assistant.',
      tools: {
        web_search: searchTool,
        createBom: createBomTool,
      },
      memory: mockMemory,
    });

    // Stream the response
    const stream = await agent.stream('Create a bill of materials for orange juice', {
      threadId,
      resourceId,
    });

    // Consume the stream
    await stream.consumeStream();

    // Wait for save operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Retrieve messages from storage
    const storedMessages = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // Find the assistant message with parts
    const assistantMessages = storedMessages.messages.filter(
      (msg: MastraDBMessage) => msg.role === 'assistant',
    ) as MastraDBMessage[];

    expect(assistantMessages.length).toBeGreaterThan(0);

    // Get the last assistant message which should have all the merged parts
    const assistantMessage = assistantMessages[assistantMessages.length - 1];

    // Extract text and tool parts in order
    const parts = assistantMessage.content.parts;
    const partTypes = parts.map((p: any) => {
      if (p.type === 'text') return `text:${p.text.substring(0, 20)}...`;
      if (p.type === 'tool-invocation') return `tool:${p.toolInvocation.toolName}`;
      if (p.type === 'step-start') return 'step-start';
      return p.type;
    });

    console.log('Part types in order:', partTypes);

    // Verify the correct ordering:
    // 1. First text (starts with "I'll create")
    // 2. Tool invocation (web_search)
    // 3. Second text (starts with "Based on") - should come AFTER web_search
    // 4. Tool invocation (createBom)
    // 5. Third text (starts with "Perfect")

    // Find indices of each part type
    const textParts = parts.filter((p: any) => p.type === 'text') as Array<{ type: 'text'; text: string }>;
    const toolParts = parts.filter((p: any) => p.type === 'tool-invocation') as Array<{
      type: 'tool-invocation';
      toolInvocation: { toolName: string };
    }>;

    // Should have 3 text parts
    expect(textParts.length).toBe(3);

    // Should have 2 tool invocations
    expect(toolParts.length).toBe(2);

    // Verify text content is present and not lost
    const firstText = textParts[0]?.text || '';
    const secondText = textParts[1]?.text || '';
    const thirdText = textParts[2]?.text || '';

    // CRITICAL: First text should start with "I'll create" - this is often lost (the bug)
    expect(firstText).toContain("I'll create");
    expect(firstText).toContain('bill of materials');

    // Second text should contain "Based on the market research"
    expect(secondText).toContain('Based on the market research');

    // Third text should contain "Perfect"
    expect(thirdText).toContain('Perfect');

    // Verify ordering: find positions in the parts array
    const firstTextIndex = parts.findIndex((p: any) => p.type === 'text' && p.text.includes("I'll create"));
    const webSearchIndex = parts.findIndex(
      (p: any) => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search',
    );
    const secondTextIndex = parts.findIndex((p: any) => p.type === 'text' && p.text.includes('Based on'));
    const createBomIndex = parts.findIndex(
      (p: any) => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'createBom',
    );
    const thirdTextIndex = parts.findIndex((p: any) => p.type === 'text' && p.text.includes('Perfect'));

    console.log('Indices:', {
      firstTextIndex,
      webSearchIndex,
      secondTextIndex,
      createBomIndex,
      thirdTextIndex,
    });

    // Verify the ordering is correct
    // CRITICAL: First text should come BEFORE web_search
    expect(firstTextIndex).toBeLessThan(webSearchIndex);

    // CRITICAL: Second text should come AFTER web_search but BEFORE createBom
    // This is the bug: the second text often appears BEFORE the web_search call
    expect(secondTextIndex).toBeGreaterThan(webSearchIndex);
    expect(secondTextIndex).toBeLessThan(createBomIndex);

    // Third text should come AFTER createBom
    expect(thirdTextIndex).toBeGreaterThan(createBomIndex);
  });

  it('should preserve text ordering after storage round-trip', async () => {
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ message: z.string() }),
      execute: async input => input.message,
    });

    // Simpler test case: text → tool → text
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'test', modelId: 'test', timestamp: new Date() },

          // Text before tool
          { type: 'text-start', id: '0' },
          { type: 'text-delta', id: '0', delta: 'Let me echo that for you.' },
          { type: 'text-end', id: '0' },

          // Tool call
          {
            type: 'tool-input-start',
            id: 'echo-1',
            toolName: 'echo',
          },
          {
            type: 'tool-input-delta',
            id: 'echo-1',
            delta: '{"message":"hello"}',
          },
          { type: 'tool-input-end', id: 'echo-1' },
          {
            type: 'tool-call',
            toolCallId: 'echo-1',
            toolName: 'echo',
            input: '{"message":"hello"}',
          },
          {
            type: 'tool-result',
            toolCallId: 'echo-1',
            toolName: 'echo',
            result: 'hello',
          },

          // Text after tool
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'The echo returned: hello' },
          { type: 'text-end', id: '1' },

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

    const threadId = 'test-thread-roundtrip';
    const resourceId = 'test-resource-roundtrip';

    const agent = new Agent({
      id: 'test-roundtrip-agent',
      name: 'Test Roundtrip Agent',
      model: mockModel,
      instructions: 'You are a helpful assistant.',
      tools: { echo: echoTool },
      memory: mockMemory,
    });

    // Stream the response
    const stream = await agent.stream('Echo hello', {
      threadId,
      resourceId,
    });

    // Consume the stream
    await stream.consumeStream();

    // Wait for save operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Retrieve from storage
    const result = await mockMemory.recall({ threadId, resourceId });
    const assistantMessages = result.messages.filter((m: MastraDBMessage) => m.role === 'assistant');

    expect(assistantMessages.length).toBeGreaterThan(0);

    const assistantMessage = assistantMessages[assistantMessages.length - 1] as MastraDBMessage;
    const parts = assistantMessage.content.parts;

    // Find positions
    const textBeforeIndex = parts.findIndex((p: any) => p.type === 'text' && p.text.includes('echo that'));
    const toolIndex = parts.findIndex((p: any) => p.type === 'tool-invocation');
    const textAfterIndex = parts.findIndex((p: any) => p.type === 'text' && p.text.includes('returned'));

    console.log(
      'Round-trip parts:',
      parts.map((p: any) => p.type),
    );
    console.log('Round-trip indices:', { textBeforeIndex, toolIndex, textAfterIndex });

    // CRITICAL: The text "Let me echo that" should appear BEFORE the tool call
    // This is the bug being reported - text before tool calls is often missing or misplaced
    expect(textBeforeIndex).toBeGreaterThanOrEqual(0); // Text should exist
    expect(textBeforeIndex).toBeLessThan(toolIndex); // Text should come before tool

    // Text after tool should come after the tool
    expect(textAfterIndex).toBeGreaterThan(toolIndex);
  });
});

/**
 * Integration test with a real model
 *
 * This test verifies the fix works end-to-end with actual OpenAI API calls.
 * It is skipped if OPENAI_API_KEY is not set in the environment.
 */
describe.skipIf(!process.env.OPENAI_API_KEY)('GitHub Issue #9909 - Integration test with real model', () => {
  let mockMemory: MockMemory;

  beforeEach(() => {
    mockMemory = new MockMemory();
  });

  it('should preserve text ordering with real OpenAI model', { timeout: 60000, retry: 2 }, async () => {
    const searchTool = createTool({
      id: 'web_search',
      description: 'Search the web for information. Always use this before answering factual questions.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async input => {
        return `Search results for "${input.query}": Found relevant information about the topic.`;
      },
    });

    const threadId = `test-thread-real-model-${Date.now()}`;
    const resourceId = 'test-resource-real-model';

    const agent = new Agent({
      id: 'test-real-model-agent',
      name: 'Test Real Model Agent',
      model: openai('gpt-4o-mini'),
      instructions:
        'You are a helpful assistant. When asked a question, ALWAYS explain what you are about to do BEFORE using any tools. After getting tool results, explain what you found. Be verbose and conversational.',
      tools: {
        web_search: searchTool,
      },
      memory: mockMemory,
    });

    // Stream the response - asking a question that should trigger:
    // 1. Text explaining what the agent will do
    // 2. Tool call (web_search)
    // 3. Text explaining the results
    const stream = await agent.stream(
      'What is the current weather forecast for San Francisco? Please search for this information.',
      {
        threadId,
        resourceId,
      },
    );

    // Consume the stream
    await stream.consumeStream();

    // Wait for save operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Retrieve messages from storage
    const storedMessages = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // Find the assistant message with parts
    const assistantMessages = storedMessages.messages.filter(
      (msg: MastraDBMessage) => msg.role === 'assistant',
    ) as MastraDBMessage[];

    expect(assistantMessages.length).toBeGreaterThan(0);

    // Get the last assistant message which should have all the merged parts
    const assistantMessage = assistantMessages[assistantMessages.length - 1];

    // Extract text and tool parts in order
    const parts = assistantMessage.content.parts;
    const textParts = parts.filter((p: any) => p.type === 'text') as Array<{ type: 'text'; text: string }>;
    const toolParts = parts.filter((p: any) => p.type === 'tool-invocation') as Array<{
      type: 'tool-invocation';
      toolInvocation: { toolName: string };
    }>;

    console.log(
      'Real model - Part types in order:',
      parts.map((p: any) => {
        if (p.type === 'text') return `text:${p.text.substring(0, 30)}...`;
        if (p.type === 'tool-invocation') return `tool:${p.toolInvocation.toolName}`;
        if (p.type === 'step-start') return 'step-start';
        return p.type;
      }),
    );

    // Should have at least 1 tool invocation (web_search)
    expect(toolParts.length).toBeGreaterThanOrEqual(1);

    // Should have at least 2 text parts (before and after tool call)
    // Note: The model may produce more or fewer text parts, but we expect at least 2
    expect(textParts.length).toBeGreaterThanOrEqual(2);

    // Find the web_search tool invocation
    const webSearchIndex = parts.findIndex(
      (p: any) => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search',
    );

    // There should be at least one text part before the tool call
    const textBeforeToolIndex = parts.findIndex((p: any, idx: number) => p.type === 'text' && idx < webSearchIndex);

    // There should be at least one text part after the tool call
    const textAfterToolIndex = parts.findIndex((p: any, idx: number) => p.type === 'text' && idx > webSearchIndex);

    console.log('Real model indices:', { textBeforeToolIndex, webSearchIndex, textAfterToolIndex });

    // CRITICAL: Text should exist both before and after the tool call
    expect(textBeforeToolIndex).toBeGreaterThanOrEqual(0);
    expect(webSearchIndex).toBeGreaterThan(textBeforeToolIndex);
    expect(textAfterToolIndex).toBeGreaterThan(webSearchIndex);
  });

  it('should preserve multiple text sections between multiple tool calls', { timeout: 90000, retry: 2 }, async () => {
    const weatherTool = createTool({
      id: 'get_weather',
      description: 'Get the current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('The city name'),
      }),
      execute: async input => {
        return { location: input.location, temperature: 72, conditions: 'sunny' };
      },
    });

    const forecastTool = createTool({
      id: 'get_forecast',
      description: 'Get the weather forecast for the next few days',
      inputSchema: z.object({
        location: z.string().describe('The city name'),
        days: z.number().describe('Number of days'),
      }),
      execute: async input => {
        return {
          location: input.location,
          forecast: [
            { day: 1, temp: 70, conditions: 'sunny' },
            { day: 2, temp: 68, conditions: 'cloudy' },
          ],
        };
      },
    });

    const threadId = `test-thread-multi-tool-${Date.now()}`;
    const resourceId = 'test-resource-multi-tool';

    const agent = new Agent({
      id: 'test-multi-tool-agent',
      name: 'Test Multi Tool Agent',
      model: openai('gpt-4o-mini'),
      instructions:
        'You are a weather assistant. When asked about weather, first explain what you will do, then get the current weather, explain what you found, then get the forecast, and finally summarize everything. Always be verbose between tool calls.',
      tools: {
        get_weather: weatherTool,
        get_forecast: forecastTool,
      },
      memory: mockMemory,
    });

    const stream = await agent.stream('What is the weather in New York and what will it be like for the next 2 days?', {
      threadId,
      resourceId,
    });

    await stream.consumeStream();
    await new Promise(resolve => setTimeout(resolve, 500));

    const storedMessages = await mockMemory.recall({
      threadId,
      resourceId,
    });

    const assistantMessages = storedMessages.messages.filter(
      (msg: MastraDBMessage) => msg.role === 'assistant',
    ) as MastraDBMessage[];

    expect(assistantMessages.length).toBeGreaterThan(0);

    const assistantMessage = assistantMessages[assistantMessages.length - 1];
    const parts = assistantMessage.content.parts;

    const textParts = parts.filter((p: any) => p.type === 'text');
    const toolParts = parts.filter((p: any) => p.type === 'tool-invocation');

    console.log(
      'Multi-tool test - Part types:',
      parts.map((p: any) => {
        if (p.type === 'text') return `text:${p.text.substring(0, 20)}...`;
        if (p.type === 'tool-invocation') return `tool:${p.toolInvocation.toolName}`;
        return p.type;
      }),
    );

    // Should have at least 2 tool invocations
    expect(toolParts.length).toBeGreaterThanOrEqual(2);

    // Should have text parts interspersed
    expect(textParts.length).toBeGreaterThanOrEqual(2);

    // Verify ordering is maintained - text and tools should alternate in a sensible way
    // The key verification is that no text content is lost and ordering is preserved
    let foundText = false;
    let foundTool = false;
    let textBeforeTool = false;
    let textAfterTool = false;

    for (const part of parts) {
      if ((part as any).type === 'text' && !foundTool) {
        foundText = true;
      }
      if ((part as any).type === 'tool-invocation') {
        if (foundText) {
          textBeforeTool = true;
        }
        foundTool = true;
      }
      if ((part as any).type === 'text' && foundTool) {
        textAfterTool = true;
      }
    }

    expect(textBeforeTool).toBe(true);
    expect(textAfterTool).toBe(true);
  });
});
