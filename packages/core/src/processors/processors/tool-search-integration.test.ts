import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { MessageList } from '../../agent/message-list';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';

import { ToolSearchProcessor } from './tool-search';

/**
 * Integration tests for ToolSearchProcessor with Agent.
 * Tests the full workflow: search -> load -> use tools dynamically.
 */
describe('ToolSearchProcessor Integration with Agent', () => {
  // Note: No beforeEach cleanup needed - each processor instance has its own isolated state

  it('should allow agent to discover and load tools dynamically', async () => {
    // Create a set of tools to search from
    const weatherTool = createTool({
      id: 'weather',
      description: 'Get current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72,
        conditions: 'sunny',
      }),
    });

    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Perform basic arithmetic calculations',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ operation, a, b }) => {
        switch (operation) {
          case 'add':
            return a + b;
          case 'subtract':
            return a - b;
          case 'multiply':
            return a * b;
          case 'divide':
            return a / b;
        }
      },
    });

    const emailTool = createTool({
      id: 'send_email',
      description: 'Send an email to a recipient',
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
      }),
      execute: async ({ to, subject }) => ({
        success: true,
        messageId: 'msg-123',
        to,
        subject,
      }),
    });

    // Create ToolSearchProcessor with all tools
    const toolSearch = new ToolSearchProcessor({
      tools: {
        weather: weatherTool,
        calculator: calculatorTool,
        send_email: emailTool,
      },
      search: { topK: 5, minScore: 0 },
    });

    // Create agent with processor
    const _agent = new Agent({
      id: 'test-dynamic-tools-agent',
      name: 'test-dynamic-tools-agent',
      instructions: 'You are a helpful assistant with access to various tools.',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    // Verify agent was created
    expect(_agent).toBeDefined();
    expect(_agent.name).toBe('test-dynamic-tools-agent');

    // Test that the processor works by directly calling processInputStep
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread-1');

    const args = {
      messageList: new MessageList({}),
      requestContext,
      tools: {},
    };

    // First call - should inject search_tools and load_tool
    const result1 = await toolSearch.processInputStep(args);

    expect(result1.tools).toBeDefined();
    expect(result1.tools?.search_tools).toBeDefined();
    expect(result1.tools?.load_tool).toBeDefined();
    expect(Object.keys(result1.tools || {}).length).toBe(2);

    // Simulate agent searching for tools
    const searchResult = await result1.tools!.search_tools.execute!({
      query: 'weather',
    });

    expect(searchResult).toHaveProperty('results');
    expect(searchResult.results).toBeInstanceOf(Array);
    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.results[0].name).toBe('weather');

    // Simulate agent loading the weather tool
    const loadResult = await result1.tools!.load_tool.execute!({
      toolName: 'weather',
    });

    expect(loadResult).toHaveProperty('success', true);
    expect(loadResult).toHaveProperty('message');
    expect(loadResult.message).toContain('weather');

    // Second call - should now include the loaded weather tool
    const result2 = await toolSearch.processInputStep(args);

    expect(result2.tools).toBeDefined();
    expect(result2.tools?.search_tools).toBeDefined();
    expect(result2.tools?.load_tool).toBeDefined();
    expect(result2.tools?.weather).toBeDefined();
    expect(Object.keys(result2.tools || {}).length).toBe(3);

    // Verify the loaded tool is the actual weather tool
    expect(result2.tools?.weather).toBe(weatherTool);
  });

  it('should maintain thread isolation across multiple threads', async () => {
    const tool1 = createTool({
      id: 'tool1',
      description: 'First tool',
      execute: async () => ({ result: 'tool1' }),
    });

    const tool2 = createTool({
      id: 'tool2',
      description: 'Second tool',
      execute: async () => ({ result: 'tool2' }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: {
        tool1,
        tool2,
      },
    });

    const _agent = new Agent({
      id: 'test-isolation-agent',
      name: 'test-isolation-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    // Create contexts for two different threads
    const context1 = new RequestContext();
    context1.set(MASTRA_THREAD_ID_KEY, 'thread-1');

    const context2 = new RequestContext();
    context2.set(MASTRA_THREAD_ID_KEY, 'thread-2');

    const args1 = {
      messageList: new MessageList({}),
      requestContext: context1,
      tools: {},
    };

    const args2 = {
      messageList: new MessageList({}),
      requestContext: context2,
      tools: {},
    };

    // Thread 1: Load tool1
    const result1a = await toolSearch.processInputStep(args1);
    await result1a.tools!.load_tool.execute!({ toolName: 'tool1' });

    // Thread 2: Load tool2
    const result2a = await toolSearch.processInputStep(args2);
    await result2a.tools!.load_tool.execute!({ toolName: 'tool2' });

    // Verify thread 1 only has tool1 loaded
    const result1b = await toolSearch.processInputStep(args1);
    expect(result1b.tools?.tool1).toBeDefined();
    expect(result1b.tools?.tool2).toBeUndefined();

    // Verify thread 2 only has tool2 loaded
    const result2b = await toolSearch.processInputStep(args2);
    expect(result2b.tools?.tool1).toBeUndefined();
    expect(result2b.tools?.tool2).toBeDefined();
  });

  it('should merge existing agent tools with loaded tools', async () => {
    const alwaysAvailableTool = createTool({
      id: 'always_available',
      description: 'This tool is always available',
      execute: async () => ({ available: true }),
    });

    const dynamicTool = createTool({
      id: 'dynamic_tool',
      description: 'This tool must be loaded dynamically',
      execute: async () => ({ dynamic: true }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: {
        dynamic_tool: dynamicTool,
      },
    });

    const _agent = new Agent({
      id: 'test-merge-agent',
      name: 'test-merge-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      tools: {
        always_available: alwaysAvailableTool,
      },
      inputProcessors: [toolSearch],
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread');

    const args = {
      messageList: new MessageList({}),
      requestContext,
      tools: {
        always_available: alwaysAvailableTool,
      },
    };

    // First call - should have meta-tools + always available tool
    const result1 = await toolSearch.processInputStep(args);
    expect(result1.tools?.search_tools).toBeDefined();
    expect(result1.tools?.load_tool).toBeDefined();
    expect(result1.tools?.always_available).toBeDefined();
    expect(result1.tools?.dynamic_tool).toBeUndefined();

    // Load the dynamic tool
    await result1.tools!.load_tool.execute!({ toolName: 'dynamic_tool' });

    // Second call - should have meta-tools + always available + dynamic tool
    const result2 = await toolSearch.processInputStep(args);
    expect(result2.tools?.search_tools).toBeDefined();
    expect(result2.tools?.load_tool).toBeDefined();
    expect(result2.tools?.always_available).toBeDefined();
    expect(result2.tools?.dynamic_tool).toBeDefined();
  });

  it('should handle search with no results gracefully', async () => {
    const tool = createTool({
      id: 'specific_tool',
      description: 'A very specific tool',
      execute: async () => ({ result: 'ok' }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: { specific_tool: tool },
    });

    const _agent = new Agent({
      id: 'test-search-agent',
      name: 'test-search-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread');

    const args = {
      messageList: new MessageList({}),
      requestContext,
      tools: {},
    };

    const result = await toolSearch.processInputStep(args);

    // Search for something that doesn't match
    const searchResult = await result.tools!.search_tools.execute!({
      query: 'completely unrelated xyz abc 123',
    });

    expect(searchResult).toHaveProperty('results');
    expect(searchResult).toHaveProperty('message');
    // Should return empty results or low-scored results below threshold
  });

  it('should handle loading non-existent tool with suggestions', async () => {
    const weatherTool = createTool({
      id: 'weather_check',
      description: 'Check weather',
      execute: async () => ({ temp: 70 }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: { weather_check: weatherTool },
    });

    const _agent = new Agent({
      id: 'test-error-agent',
      name: 'test-error-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread');

    const args = {
      messageList: new MessageList({}),
      requestContext,
      tools: {},
    };

    const result = await toolSearch.processInputStep(args);

    // Try to load a tool that doesn't exist but is similar
    const loadResult = await result.tools!.load_tool.execute!({
      toolName: 'weather',
    });

    expect(loadResult).toHaveProperty('success', false);
    expect(loadResult).toHaveProperty('message');
    expect(loadResult.message).toContain('weather_check');
  });

  it('should handle loading already-loaded tool gracefully', async () => {
    const tool = createTool({
      id: 'test_tool',
      description: 'Test tool',
      execute: async () => ({ result: 'ok' }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: { test_tool: tool },
    });

    const _agent = new Agent({
      id: 'test-duplicate-agent',
      name: 'test-duplicate-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread');

    const args = {
      messageList: new MessageList({}),
      requestContext,
      tools: {},
    };

    const result1 = await toolSearch.processInputStep(args);

    // Load tool first time
    const loadResult1 = await result1.tools!.load_tool.execute!({
      toolName: 'test_tool',
    });
    expect(loadResult1).toHaveProperty('success', true);

    // Try to load again
    const loadResult2 = await result1.tools!.load_tool.execute!({
      toolName: 'test_tool',
    });
    expect(loadResult2).toHaveProperty('success', true);
    expect(loadResult2.message).toContain('already loaded');
  });

  it('should include system message explaining meta-tools', async () => {
    const tool = createTool({
      id: 'test_tool',
      description: 'Test tool',
      execute: async () => ({ result: 'ok' }),
    });

    const toolSearch = new ToolSearchProcessor({
      tools: { test_tool: tool },
    });

    const _agent = new Agent({
      id: 'test-message-agent',
      name: 'test-message-agent',
      instructions: 'Test agent',
      model: {
        provider: 'anthropic',
        name: 'claude-3-5-sonnet-20241022',
      },
      inputProcessors: [toolSearch],
    });

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'test-thread');

    const messageList = new MessageList({});
    messageList.startRecording();

    const args = {
      messageList,
      requestContext,
      tools: {},
    };

    await toolSearch.processInputStep(args);

    // Verify system message was added
    const events = messageList.stopRecording();
    const systemEvents = events.filter((e: any) => e.type === 'addSystem');

    expect(systemEvents.length).toBeGreaterThan(0);

    const toolSearchEvent = systemEvents.find((e: any) => {
      const content = e.message?.content;
      return typeof content === 'string' && content.includes('search_tools') && content.includes('load_tool');
    });

    expect(toolSearchEvent).toBeDefined();
    expect(toolSearchEvent.message?.content).toContain('search_tools');
    expect(toolSearchEvent.message?.content).toContain('load_tool');
  });
});
