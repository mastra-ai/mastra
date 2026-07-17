import { describe, it, expect, beforeEach } from 'vitest';

import { MessageList } from '../../agent/message-list';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import type { CoreTool } from '../../tools/types';
import { makeCoreTool } from '../../utils';
import type { ProcessInputStepArgs } from '../index';
import { ToolSearchProcessor } from './tool-search';

// Helper to create mock tools
function createMockTool(id: string, description: string): Tool<any, any> {
  return createTool({
    id,
    description,
    execute: async () => ({ success: true, toolId: id }),
  });
}

function createMockCoreTool(id: string, description: string): CoreTool {
  return makeCoreTool(createMockTool(id, description), {
    name: id,
    requestContext: new RequestContext(),
    tracingContext: {},
  });
}

// Helper to create ProcessInputStepArgs
function createMockArgs(threadId?: string, tools?: Record<string, unknown>): ProcessInputStepArgs {
  const requestContext = new RequestContext();
  if (threadId) {
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
  }
  return {
    messageList: new MessageList({}),
    requestContext,
    tools,
  };
}

describe('ToolSearchProcessor', () => {
  // Note: No beforeEach cleanup needed - each processor instance has its own isolated state

  describe('initialization', () => {
    it('should create processor with tools', () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      expect(processor.id).toBe('tool-search');
      expect(processor.name).toBe('Tool Search Processor');
    });

    it('should accept search configuration', () => {
      const processor = new ToolSearchProcessor({
        tools: {},
        search: { topK: 10, minScore: 0.5 },
      });

      expect(processor).toBeDefined();
    });

    it('should use default search configuration when not provided', () => {
      const processor = new ToolSearchProcessor({
        tools: {},
      });

      expect(processor).toBeDefined();
    });
  });

  describe('BM25 search functionality', () => {
    let processor: ToolSearchProcessor;

    beforeEach(() => {
      // Register a diverse set of tools
      processor = new ToolSearchProcessor({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a new issue on GitHub'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request on GitHub'),
          github_search_code: createMockTool('github_search_code', 'Search code in GitHub repositories'),
          linear_create_issue: createMockTool('linear_create_issue', 'Create a new issue in Linear'),
          weather_forecast: createMockTool('weather_forecast', 'Get weather forecast for a location'),
          send_email: createMockTool('send_email', 'Send an email message'),
          calendar_schedule: createMockTool('calendar_schedule', 'Schedule a calendar event'),
        },
      });
    });

    it('should find tools matching keyword', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      expect(searchTool).toBeDefined();

      const searchResult = await searchTool!.execute?.({ query: 'github' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(
        searchResult.results.every(
          (r: any) => r.name.includes('github') || r.description.toLowerCase().includes('github'),
        ),
      ).toBe(true);
    });

    it('should find tools by description keywords', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'issue' }, undefined);

      expect(searchResult.results.length).toBe(2);
      const names = searchResult.results.map((r: any) => r.name);
      expect(names).toContain('github_create_issue');
      expect(names).toContain('linear_create_issue');
    });

    it('should boost exact name matches', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'weather' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      // weather_forecast should be first due to name match boost
      expect(searchResult.results[0].name).toBe('weather_forecast');
    });

    it('should return empty array for no matches', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'database' }, undefined);

      expect(searchResult.results).toEqual([]);
      expect(searchResult.message).toContain('No tools found');
    });

    it('should return empty array for empty query', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: '' }, undefined);

      expect(searchResult.results).toEqual([]);
    });

    it('should respect topK parameter', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a new issue on GitHub'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request on GitHub'),
          github_search_code: createMockTool('github_search_code', 'Search code in GitHub repositories'),
        },
        search: { topK: 2 },
      });

      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'github' }, undefined);

      expect(searchResult.results.length).toBeLessThanOrEqual(2);
    });

    it('should include relevance scores', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'github' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      searchResult.results.forEach((result: any) => {
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should sort results by relevance score descending', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'create' }, undefined);

      for (let i = 1; i < searchResult.results.length; i++) {
        expect(searchResult.results[i - 1].score).toBeGreaterThanOrEqual(searchResult.results[i].score);
      }
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(200);
      const processor = new ToolSearchProcessor({
        tools: {
          long_desc_tool: createMockTool('long_desc_tool', longDescription),
        },
      });

      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'long' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].description.length).toBeLessThanOrEqual(150);
    });

    it('should handle multi-word queries', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'create pull request' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].name).toBe('github_create_pr');
    });

    it('should be case insensitive', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const results1 = await searchTool!.execute?.({ query: 'GITHUB' }, undefined);
      const results2 = await searchTool!.execute?.({ query: 'github' }, undefined);

      expect(results1.results.map((r: any) => r.name)).toEqual(results2.results.map((r: any) => r.name));
    });

    it('should filter results by minScore', async () => {
      const processor1 = new ToolSearchProcessor({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a new issue on GitHub'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request on GitHub'),
          weather: createMockTool('weather', 'Get weather'),
        },
        search: { minScore: 0 },
      });

      const processor2 = new ToolSearchProcessor({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a new issue on GitHub'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request on GitHub'),
          weather: createMockTool('weather', 'Get weather'),
        },
        search: { minScore: 5 },
      });

      const args1 = createMockArgs('test-thread-1');
      const result1 = await processor1.processInputStep(args1);
      const searchTool1 = result1.tools?.search_tools;
      const allResults = await searchTool1!.execute?.({ query: 'a' }, undefined);

      const args2 = createMockArgs('test-thread-2');
      const result2 = await processor2.processInputStep(args2);
      const searchTool2 = result2.tools?.search_tools;
      const filteredResults = await searchTool2!.execute?.({ query: 'a' }, undefined);

      expect(filteredResults.results.length).toBeLessThanOrEqual(allResults.results.length);
      filteredResults.results.forEach((r: any) => {
        expect(r.score).toBeGreaterThan(5);
      });
    });

    it('should include helpful message with results', async () => {
      const args = createMockArgs('test-thread');
      const result = await processor.processInputStep(args);

      const searchTool = result.tools?.search_tools;
      const searchResult = await searchTool!.execute?.({ query: 'weather' }, undefined);

      expect(searchResult.message).toContain('Found');
      expect(searchResult.message).toContain('load_tool');
    });
  });

  describe('thread-scoped state management', () => {
    it('should track loaded tools per thread', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const args1 = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args1);
      const loadTool1 = result1.tools?.load_tool;

      const args2 = createMockArgs('thread-2');
      const result2 = await processor.processInputStep(args2);
      const loadTool2 = result2.tools?.load_tool;

      // Load different tools in different threads
      await loadTool1!.execute?.({ toolName: 'weather' }, undefined);
      await loadTool2!.execute?.({ toolName: 'calendar' }, undefined);

      // Check that tools are isolated per thread
      const args1_next = createMockArgs('thread-1');
      const result1_next = await processor.processInputStep(args1_next);
      expect(result1_next.tools?.weather).toBeDefined();
      expect(result1_next.tools?.calendar).toBeUndefined();

      const args2_next = createMockArgs('thread-2');
      const result2_next = await processor.processInputStep(args2_next);
      expect(result2_next.tools?.weather).toBeUndefined();
      expect(result2_next.tools?.calendar).toBeDefined();
    });

    it('should persist loaded tools across multiple processInputStep calls', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      // First call: load weather
      const args1 = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args1);
      const loadTool = result1.tools?.load_tool;
      await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      // Second call: should still have weather
      const args2 = createMockArgs('thread-1');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeDefined();

      // Third call: load calendar
      const loadTool2 = result2.tools?.load_tool;
      await loadTool2!.execute?.({ toolName: 'calendar' }, undefined);

      // Fourth call: should have both
      const args3 = createMockArgs('thread-1');
      const result3 = await processor.processInputStep(args3);
      expect(result3.tools?.weather).toBeDefined();
      expect(result3.tools?.calendar).toBeDefined();
    });

    it('shares loaded tools across anonymous (no-threadId) requests in the default in-memory store', async () => {
      // The default in-memory store keys anonymous requests under a shared
      // 'default' entry, preserving the original behavior. (The opt-in 'context'
      // store does not share anonymous state — see tool-search-stores.test.ts.)
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs(); // No threadId
      const result = await processor.processInputStep(args);
      await result.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      const args2 = createMockArgs(); // No threadId, shares the 'default' entry
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeDefined();
    });

    it('clearState clears loaded tools for a thread in the default in-memory store', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args1 = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      processor.clearState('thread-1');

      const args1_next = createMockArgs('thread-1');
      const result1_next = await processor.processInputStep(args1_next);
      expect(result1_next.tools?.weather).toBeUndefined();
    });

    it('clearAllState clears loaded tools for all threads in the default in-memory store', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args1 = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      processor.clearAllState();

      const args1_next = createMockArgs('thread-1');
      const result1_next = await processor.processInputStep(args1_next);
      expect(result1_next.tools?.weather).toBeUndefined();
    });
  });

  describe('load_tool functionality', () => {
    it('should successfully load an existing tool', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.toolName).toBe('weather');
      expect(loadResult.message).toContain('loaded successfully');
    });

    it('should return error for non-existent tool', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolName: 'nonexistent' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).toContain('not found');
    });

    it('should suggest similar tool names', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather_forecast: createMockTool('weather_forecast', 'Get weather'),
          weather_current: createMockTool('weather_current', 'Current weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).toContain('Did you mean');
    });

    it('should preserve key-only suggestions when filter is omitted', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather_tool_id', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-suggestion-key');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolName: 'weath' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).toContain('Did you mean: weather');
      expect(loadResult.message).not.toContain('weather_tool_id');
    });

    it('should preserve key-first load resolution when filter is omitted', async () => {
      const keyedTool = createMockTool('public_weather', 'Public weather');
      const idCollisionTool = createMockTool('weather', 'Private weather');
      const processor = new ToolSearchProcessor({
        tools: {
          weather: keyedTool,
          private_weather: idCollisionTool,
        },
      });

      const args1 = createMockArgs('thread-no-filter-key-id-collision');
      const result1 = await processor.processInputStep(args1);
      const loadResult = await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(true);

      const args2 = createMockArgs('thread-no-filter-key-id-collision');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBe(keyedTool);
    });

    it('should indicate when tool is already loaded', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      // Load once
      await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      // Load again
      const loadResult = await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.message).toContain('already loaded');
    });

    it('should load tool by tool.id when not in keys', async () => {
      const weatherTool = createMockTool('weather_tool_id', 'Get weather');
      const processor = new ToolSearchProcessor({
        tools: {
          weather: weatherTool,
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      // Load by tool.id
      const loadResult = await loadTool!.execute?.({ toolName: 'weather_tool_id' }, undefined);

      expect(loadResult.success).toBe(true);
    });

    it('should not duplicate tools', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      // Load multiple times
      await loadTool!.execute?.({ toolName: 'weather' }, undefined);
      await loadTool!.execute?.({ toolName: 'weather' }, undefined);
      await loadTool!.execute?.({ toolName: 'weather' }, undefined);

      // Should only appear once
      const args2 = createMockArgs('thread-1');
      const result2 = await processor.processInputStep(args2);
      const toolKeys = Object.keys(result2.tools || {}).filter(k => k === 'weather');
      expect(toolKeys.length).toBe(1);
    });

    it('should load multiple tools at once via toolNames array', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
          email: createMockTool('email', 'Send email'),
        },
      });

      const args = createMockArgs('thread-multi');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolNames: ['weather', 'calendar'] }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.loaded).toEqual(expect.arrayContaining(['weather', 'calendar']));
      expect(loadResult.loadedCount).toBe(2);
      expect(loadResult.notFound).toBeUndefined();
      expect(loadResult.alreadyLoaded).toBeUndefined();

      // Verify both are actually loaded
      const args2 = createMockArgs('thread-multi');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeDefined();
      expect(result2.tools?.calendar).toBeDefined();
      expect(result2.tools?.email).toBeUndefined();
    });

    it('should return clear error for empty toolNames array', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-empty');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolNames: [] }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).toBe('toolNames array must not be empty.');
    });

    it('should report not-found tools in multi-load response', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-multi');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      const loadResult = await loadTool!.execute?.({ toolNames: ['weather', 'nonexistent', 'calendar'] }, undefined);

      // Partial load (some found, some not): success=false since not all requested tools are available
      expect(loadResult.success).toBe(false);
      expect(loadResult.loaded).toEqual(['weather']);
      expect(loadResult.notFound).toEqual(['nonexistent', 'calendar']);
      expect(loadResult.loadedCount).toBe(1);
    });

    it('should report already-loaded tools in multi-load response', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const args1 = createMockArgs('thread-multi');
      const result1 = await processor.processInputStep(args1);
      const loadTool1 = result1.tools?.load_tool;
      await loadTool1!.execute?.({ toolName: 'weather' }, undefined);

      // Try loading weather again alongside calendar
      const args2 = createMockArgs('thread-multi');
      const result2 = await processor.processInputStep(args2);
      const loadTool2 = result2.tools?.load_tool;

      const loadResult = await loadTool2!.execute?.({ toolNames: ['weather', 'calendar'] }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.loaded).toEqual(['calendar']);
      expect(loadResult.alreadyLoaded).toEqual(['weather']);
      expect(loadResult.loadedCount).toBe(1);
    });

    it('should return success=true when all requested tools are already loaded', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const args1 = createMockArgs('thread-multi');
      const result1 = await processor.processInputStep(args1);
      const loadTool1 = result1.tools?.load_tool;
      await loadTool1!.execute?.({ toolNames: ['weather', 'calendar'] }, undefined);

      // All already loaded — should be success even though nothing new was loaded
      const args2 = createMockArgs('thread-multi');
      const result2 = await processor.processInputStep(args2);
      const loadTool2 = result2.tools?.load_tool;

      const loadResult = await loadTool2!.execute?.({ toolNames: ['weather', 'calendar'] }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.loaded).toBeUndefined();
      expect(loadResult.alreadyLoaded).toEqual(['weather', 'calendar']);
      expect(loadResult.notFound).toBeUndefined();
    });

    it('should merge and deduplicate when both toolName and toolNames are provided', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const args = createMockArgs('thread-merge');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      // toolName 'weather' should be merged with toolNames ['calendar']
      const loadResult = await loadTool!.execute?.({ toolName: 'weather', toolNames: ['calendar'] }, undefined);

      expect(loadResult.success).toBe(true);
      // weather from toolName, calendar from toolNames — both deduplicated
      expect(loadResult.loaded).toEqual(expect.arrayContaining(['weather', 'calendar']));
      expect(loadResult.loadedCount).toBe(2);
    });

    it('should deduplicate duplicate names within toolNames array', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-dedup');
      const result = await processor.processInputStep(args);
      const loadTool = result.tools?.load_tool;

      // Duplicate 'weather' entries should only load once
      const loadResult = await loadTool!.execute?.({ toolNames: ['weather', 'weather'] }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.loaded).toEqual(['weather']);
      expect(loadResult.loadedCount).toBe(1);
    });
  });

  describe('request-aware filtering', () => {
    it('should filter search results with filter', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather forecast'),
          weather_alerts: createMockTool('weather_alerts', 'Get weather alerts'),
        },
        filter: ({ toolName, phase }) => phase !== 'search' || toolName !== 'weather_alerts',
      });

      const args = createMockArgs('thread-filter-search');
      const result = await processor.processInputStep(args);
      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);

      expect(searchResult.results.map((tool: any) => tool.name)).toEqual(['weather']);
    });

    it('should filter search results against the indexed tool id when keys collide with tool ids', async () => {
      const privateTool = createMockTool('weather', 'Private weather forecast');
      const publicTool = createMockTool('public_weather', 'Public weather forecast');
      const processor = new ToolSearchProcessor({
        tools: {
          private_weather: privateTool,
          weather: publicTool,
        },
        filter: ({ toolName }) => toolName !== 'weather',
      });

      const args = createMockArgs('thread-filter-key-id-collision');
      const result = await processor.processInputStep(args);
      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);

      expect(searchResult.results.map((tool: any) => tool.name)).toEqual(['public_weather']);
    });

    it('should support async filter hooks', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather forecast'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
        filter: async ({ toolName, phase }) => {
          await Promise.resolve();
          return phase !== 'search' || toolName !== 'calendar';
        },
      });

      const args = createMockArgs('thread-async-filter');
      const result = await processor.processInputStep(args);
      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'calendar' }, undefined);

      expect(searchResult.results).toEqual([]);
    });

    it('should block loading disallowed tools', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
        filter: ({ phase }) => phase !== 'load',
      });

      const args1 = createMockArgs('thread-load-filter');
      const result1 = await processor.processInputStep(args1);
      const loadResult = await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.toolName).toBe('weather');

      const args2 = createMockArgs('thread-load-filter');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeUndefined();
    });

    it('should filter load requests against the resolved tool id when keys collide with tool ids', async () => {
      const privateTool = createMockTool('weather', 'Private weather forecast');
      const publicTool = createMockTool('public_weather', 'Public weather forecast');
      const processor = new ToolSearchProcessor({
        tools: {
          private_weather: privateTool,
          weather: publicTool,
        },
        filter: ({ toolName }) => toolName !== 'weather',
      });

      const args1 = createMockArgs('thread-load-key-id-collision');
      const result1 = await processor.processInputStep(args1);
      const loadResult = await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(loadResult.success).toBe(false);

      const args2 = createMockArgs('thread-load-key-id-collision');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeUndefined();
    });

    it('should not leak disallowed tools in load suggestions', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          premium_weather: createMockTool('premium_weather', 'Premium weather'),
          public_weather: createMockTool('public_weather', 'Public weather'),
        },
        filter: ({ toolName }) => toolName !== 'premium_weather',
      });

      const args = createMockArgs('thread-filter-suggestions');
      const result = await processor.processInputStep(args);
      const loadResult = await result.tools?.load_tool!.execute?.({ toolName: 'premium' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).not.toContain('premium_weather');
    });

    it('should not suggest filtered key aliases that resolve to disallowed tool ids', async () => {
      const privateTool = createMockTool('weather', 'Private weather forecast');
      const publicTool = createMockTool('public_weather', 'Public weather forecast');
      const processor = new ToolSearchProcessor({
        tools: {
          private_weather: privateTool,
          weather: publicTool,
        },
        filter: ({ toolName }) => toolName !== 'weather',
      });

      const args = createMockArgs('thread-filter-suggestions-key-id-collision');
      const result = await processor.processInputStep(args);
      const loadResult = await result.tools?.load_tool!.execute?.({ toolName: 'weath' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).not.toContain('Did you mean: weather');
    });

    it('should fill search results from lower-ranked allowed matches', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          premium_a: createMockTool('premium_a', 'Shared capability'),
          premium_b: createMockTool('premium_b', 'Shared capability'),
          premium_c: createMockTool('premium_c', 'Shared capability'),
          premium_d: createMockTool('premium_d', 'Shared capability'),
          public_a: createMockTool('public_a', 'Shared capability'),
          public_b: createMockTool('public_b', 'Shared capability'),
        },
        search: { topK: 2 },
        filter: ({ toolName, phase }) => phase !== 'search' || toolName.startsWith('public_'),
      });

      const args = createMockArgs('thread-filter-fill');
      const result = await processor.processInputStep(args);
      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'shared' }, undefined);

      expect(searchResult.results.map((tool: any) => tool.name)).toEqual(['public_a', 'public_b']);
    });

    it('should pass resolved tool id, tool, request context, and phase to filter', async () => {
      const calls: Array<{ toolName: string; tool: Tool<any, any>; requestContext?: RequestContext; phase: string }> =
        [];
      const weatherTool = createMockTool('weather_tool_id', 'Get weather');
      const processor = new ToolSearchProcessor({
        tools: {
          weather: weatherTool,
        },
        filter: args => {
          calls.push(args);
          return true;
        },
      });

      const args1 = createMockArgs('thread-filter-args');
      args1.requestContext?.set('plan', 'pro');
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      const args2 = createMockArgs('thread-filter-args');
      args2.requestContext?.set('plan', 'pro');
      await processor.processInputStep(args2);

      expect(calls.map(call => call.phase)).toEqual(['search', 'load', 'active']);
      expect(calls.every(call => call.toolName === 'weather_tool_id')).toBe(true);
      expect(calls.every(call => call.tool === weatherTool)).toBe(true);
      expect(calls.every(call => call.requestContext?.get('plan') === 'pro')).toBe(true);
    });

    it('should fail closed when filter throws', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
        filter: () => {
          throw new Error('policy unavailable');
        },
      });

      const args = createMockArgs('thread-filter-throws');
      const result = await processor.processInputStep(args);
      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      const loadResult = await result.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(searchResult.results).toEqual([]);
      expect(loadResult.success).toBe(false);
    });

    it('should filter active loaded tools per request without clearing thread state', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
        filter: ({ phase, requestContext }) => {
          if (phase !== 'active') return true;
          return requestContext?.get('allowWeather') === true;
        },
      });

      const args1 = createMockArgs('thread-active-filter');
      args1.requestContext?.set('allowWeather', true);
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      const disallowedArgs = createMockArgs('thread-active-filter');
      disallowedArgs.requestContext?.set('allowWeather', false);
      const disallowedResult = await processor.processInputStep(disallowedArgs);
      expect(disallowedResult.tools?.weather).toBeUndefined();

      const allowedArgs = createMockArgs('thread-active-filter');
      allowedArgs.requestContext?.set('allowWeather', true);
      const allowedResult = await processor.processInputStep(allowedArgs);
      expect(allowedResult.tools?.weather).toBeDefined();
    });

    it('should preserve existing tools passed to processInputStep when filter is provided', async () => {
      const existingTool = createMockTool('weather', 'Existing weather tool');
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Dynamic weather tool'),
        },
        filter: () => false,
      });

      const args = createMockArgs('thread-existing-filter', { weather: existingTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.weather).toBe(existingTool);
    });

    it('should keep existing behavior when filter is omitted', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args1 = createMockArgs('thread-no-filter');
      const result1 = await processor.processInputStep(args1);
      const searchResult = await result1.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      const loadResult = await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(searchResult.results[0].name).toBe('weather');
      expect(loadResult.success).toBe(true);

      const args2 = createMockArgs('thread-no-filter');
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather).toBeDefined();
    });
  });

  describe('processInputStep integration', () => {
    it('should return meta-tools (search_tools and load_tool)', async () => {
      const processor = new ToolSearchProcessor({
        tools: {},
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);

      expect(result.tools?.search_tools).toBeDefined();
      expect(result.tools?.load_tool).toBeDefined();
    });

    it('should preserve existing tools passed to agent', async () => {
      const processor = new ToolSearchProcessor({
        tools: {},
      });

      const existingTool = createMockTool('existing', 'Existing tool');
      const args = createMockArgs('thread-1', { existing: existingTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.existing).toBeDefined();
      expect(result.tools?.existing).toBe(existingTool);
    });

    it('should merge meta-tools, existing tools, and loaded tools', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const existingTool = createMockTool('existing', 'Existing tool');

      // First call: load weather
      const args1 = createMockArgs('thread-1', { existing: existingTool });
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      // Second call: should have all three types
      const args2 = createMockArgs('thread-1', { existing: existingTool });
      const result2 = await processor.processInputStep(args2);

      expect(result2.tools?.search_tools).toBeDefined(); // Meta-tool
      expect(result2.tools?.load_tool).toBeDefined(); // Meta-tool
      expect(result2.tools?.existing).toBeDefined(); // Existing tool
      expect(result2.tools?.weather).toBeDefined(); // Loaded tool
    });

    it('should call addSystem to explain meta-tools', async () => {
      const processor = new ToolSearchProcessor({
        tools: {},
      });

      const messageList = new MessageList({});
      // Start recording to capture addSystem calls
      messageList.startRecording();

      const args = createMockArgs('thread-1');
      args.messageList = messageList;

      await processor.processInputStep(args);

      // Check that addSystem was called
      const events = messageList.stopRecording();
      const systemEvents = events.filter(e => e.type === 'addSystem');
      expect(systemEvents.length).toBeGreaterThan(0);

      // Check that the system message mentions search_tools
      const hasSearchTools = systemEvents.some(e => {
        const content = e.message?.content;
        if (typeof content === 'string') {
          return content.includes('search_tools');
        }
        return false;
      });
      expect(hasSearchTools).toBe(true);
    });

    it('should not have duplicate tools in returned object', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      // Create a scenario where we might have duplicates
      const existingWeatherTool = createMockTool('weather', 'Different weather tool');
      const args1 = createMockArgs('thread-1', { weather: existingWeatherTool });
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      // Second call with same existing tool
      const args2 = createMockArgs('thread-1', { weather: existingWeatherTool });
      const result2 = await processor.processInputStep(args2);

      // Count how many 'weather' keys exist
      const weatherKeys = Object.keys(result2.tools || {}).filter(k => k === 'weather');
      expect(weatherKeys.length).toBe(1);
    });
  });

  describe('full workflow', () => {
    it('should support complete search -> load -> use flow', async () => {
      const weatherTool = createMockTool('weather_forecast', 'Get weather forecast for any location');
      const calendarTool = createMockTool('calendar_schedule', 'Schedule calendar events');

      const processor = new ToolSearchProcessor({
        tools: {
          weather_forecast: weatherTool,
          calendar_schedule: calendarTool,
        },
      });

      const threadId = 'workflow-thread';

      // Step 1: Search for weather tools
      const args1 = createMockArgs(threadId);
      const result1 = await processor.processInputStep(args1);
      const searchResult = await result1.tools?.search_tools!.execute?.({ query: 'weather forecast' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].name).toBe('weather_forecast');

      // Step 2: Load the found tool
      const loadResult = await result1.tools?.load_tool!.execute?.({ toolName: 'weather_forecast' }, undefined);
      expect(loadResult.success).toBe(true);

      // Step 3: Tool is available on next turn
      const args2 = createMockArgs(threadId);
      const result2 = await processor.processInputStep(args2);
      expect(result2.tools?.weather_forecast).toBeDefined();
      expect(result2.tools?.weather_forecast?.id).toBe('weather_forecast');

      // Step 4: Execute the loaded tool
      const toolResult = await result2.tools?.weather_forecast!.execute?.({}, undefined);
      expect(toolResult.success).toBe(true);
      expect(toolResult.toolId).toBe('weather_forecast');
    });

    it('should support multi-turn conversation with tool discovery', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a GitHub issue'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request'),
          linear_create_issue: createMockTool('linear_create_issue', 'Create a Linear issue'),
        },
      });

      const threadId = 'conversation-thread';

      // Turn 1: Search for GitHub tools
      const args1 = createMockArgs(threadId);
      const result1 = await processor.processInputStep(args1);
      const searchResult1 = await result1.tools?.search_tools!.execute?.({ query: 'github' }, undefined);
      expect(searchResult1.results.length).toBe(2);

      // Turn 2: Load github_create_issue
      const args2 = createMockArgs(threadId);
      const result2 = await processor.processInputStep(args2);
      await result2.tools?.load_tool!.execute?.({ toolName: 'github_create_issue' }, undefined);

      // Turn 3: Use loaded tool and search for more
      const args3 = createMockArgs(threadId);
      const result3 = await processor.processInputStep(args3);
      expect(result3.tools?.github_create_issue).toBeDefined();
      const searchResult3 = await result3.tools?.search_tools!.execute?.({ query: 'linear' }, undefined);
      expect(searchResult3.results.length).toBe(1);

      // Turn 4: Load linear tool - should have both now
      const args4 = createMockArgs(threadId);
      const result4 = await processor.processInputStep(args4);
      await result4.tools?.load_tool!.execute?.({ toolName: 'linear_create_issue' }, undefined);

      // Turn 5: Both tools available
      const args5 = createMockArgs(threadId);
      const result5 = await processor.processInputStep(args5);
      expect(result5.tools?.github_create_issue).toBeDefined();
      expect(result5.tools?.linear_create_issue).toBeDefined();
    });
  });

  describe('in-memory TTL / state-stats API (default store)', () => {
    it('evicts stale thread state via the ttl option', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
        ttl: 50,
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      await result.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      // Wait past the TTL, then trigger cleanup. The thread's state is evicted.
      await new Promise(r => setTimeout(r, 80));
      const cleaned = processor.cleanupNow();
      expect(cleaned).toBeGreaterThanOrEqual(1);

      const next = await processor.processInputStep(createMockArgs('thread-1'));
      expect(next.tools?.weather).toBeUndefined();
    });

    it('getStateStats reports loaded-thread counts for the in-memory store', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      await result.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      const stats = processor.getStateStats();
      expect(stats.threadCount).toBe(1);
      expect(stats.oldestAccessTime).not.toBeNull();
    });

    it('cleanupNow returns 0 when nothing is stale', () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      expect(processor.cleanupNow()).toBe(0);
    });

    it('getStateStats and cleanupNow are inert for opt-in stores', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
        storage: 'context',
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      await result.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);

      expect(processor.getStateStats().threadCount).toBe(0);
      expect(processor.cleanupNow()).toBe(0);
    });
  });

  describe('cache-friendliness (prefix stability)', () => {
    // Build step args carrying conversation messages with the given load_tool
    // results, plus a real thread ID — used to drive 'context' mode de-loading.
    function argsWithLoadedMessages(threadId: string, loadedNames: string[][]): ProcessInputStepArgs {
      const base = createMockArgs(threadId);
      return {
        ...base,
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content: {
              format: 2,
              parts: loadedNames.map((loaded, i) => ({
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: `call-${i}`,
                  toolName: 'load_tool',
                  args: {},
                  result: { loaded },
                },
              })),
            },
          },
        ],
      } as unknown as ProcessInputStepArgs;
    }

    it('loads are append-only: the cached prefix keeps its order as tools are loaded', async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      // Baseline: prefix is meta-tools then static tools (static tools are
      // excluded from the active set until loaded, leaving only the meta-tools).
      const result0 = await processor.processInputStep(createMockArgs('thread-1'));
      const prefix0 = Object.keys(result0.tools ?? {});
      expect(prefix0).toEqual(['search_tools', 'load_tool']);

      // Load weather, then calendar.
      await result0.tools?.load_tool!.execute?.({ toolName: 'weather' }, undefined);
      const result1 = await processor.processInputStep(createMockArgs('thread-1'));
      const keys1 = Object.keys(result1.tools ?? {});

      await result1.tools?.load_tool!.execute?.({ toolName: 'calendar' }, undefined);
      const result2 = await processor.processInputStep(createMockArgs('thread-1'));
      const keys2 = Object.keys(result2.tools ?? {});

      // The meta-tool prefix never moves — it stays at the front in every step.
      expect(keys1.slice(0, 2)).toEqual(['search_tools', 'load_tool']);
      expect(keys2.slice(0, 2)).toEqual(['search_tools', 'load_tool']);

      // Loaded tools are appended after the prefix. Loading calendar does not
      // reorder the already-loaded weather: weather keeps its earlier position.
      expect(keys1).toContain('weather');
      expect(keys2.indexOf('weather')).toBeLessThan(keys2.indexOf('calendar'));

      // The step-1 key sequence is a prefix of the step-2 key sequence — proving
      // the loaded set only ever grows by appending (no insertion/reorder).
      expect(keys2.slice(0, keys1.length)).toEqual(keys1);
    });

    it("'context' mode: a tool de-loads only when its discovery result leaves the messages", async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
        storage: 'context',
      });

      // While the load_tool result naming weather is present in the messages,
      // weather is active.
      const withWeather = await processor.processInputStep(argsWithLoadedMessages('thread-ctx', [['weather']]));
      expect(withWeather.tools?.weather).toBeDefined();

      // Remove the discovery result from the messages (e.g. it scrolled out of
      // the window). weather de-loads on the very next step.
      const withoutWeather = await processor.processInputStep(argsWithLoadedMessages('thread-ctx', []));
      expect(withoutWeather.tools?.weather).toBeUndefined();
    });

    it("'context' mode: an unload shrinks the active tool set (the change that moves the cache prefix)", async () => {
      const processor = new ToolSearchProcessor({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
        storage: 'context',
      });

      // Both tools loaded -> active set is meta-tools + both loaded tools.
      const loaded = await processor.processInputStep(
        argsWithLoadedMessages('thread-ctx', [['weather'], ['calendar']]),
      );
      const loadedKeys = Object.keys(loaded.tools ?? {});
      expect(loadedKeys).toEqual(['search_tools', 'load_tool', 'weather', 'calendar']);

      // Drop weather's discovery result from the messages (keep calendar's). The
      // active tool set shrinks: weather leaves, the meta-tool prefix is untouched.
      // This is precisely the change a prompt-caching provider sees as a different
      // tool-definition prefix on the next turn -> a cache write instead of a hit.
      const afterUnload = await processor.processInputStep(argsWithLoadedMessages('thread-ctx', [['calendar']]));
      const afterKeys = Object.keys(afterUnload.tools ?? {});
      expect(afterKeys).toEqual(['search_tools', 'load_tool', 'calendar']);

      // Meta-tool prefix unchanged; only the loaded tail shrank.
      expect(afterKeys.slice(0, 2)).toEqual(['search_tools', 'load_tool']);
      expect(afterUnload.tools?.weather).toBeUndefined();
      expect(afterUnload.tools?.calendar).toBeDefined();
    });
  });

  describe('autoLoad mode', () => {
    function createAutoLoadProcessor(topK = 5) {
      return new ToolSearchProcessor({
        tools: {
          weather_forecast: createMockTool('weather_forecast', 'Get weather forecast for a location'),
          weather_current: createMockTool('weather_current', 'Get current weather conditions'),
          send_email: createMockTool('send_email', 'Send an email message'),
          github_create_issue: createMockTool('github_create_issue', 'Create a new issue on GitHub'),
        },
        search: { autoLoad: true, topK },
      });
    }

    it('should not expose the load_tool meta-tool', async () => {
      const processor = createAutoLoadProcessor();
      const result = await processor.processInputStep(createMockArgs('thread-1'));

      expect(result.tools?.search_tools).toBeDefined();
      expect(result.tools?.load_tool).toBeUndefined();
    });

    it('should still expose load_tool in default (two-turn) mode', async () => {
      const processor = new ToolSearchProcessor({
        tools: { weather_forecast: createMockTool('weather_forecast', 'Get weather') },
      });
      const result = await processor.processInputStep(createMockArgs('thread-default'));

      expect(result.tools?.search_tools).toBeDefined();
      expect(result.tools?.load_tool).toBeDefined();
    });

    it('should activate matching tools as a side effect of search_tools', async () => {
      const processor = createAutoLoadProcessor();
      const result = await processor.processInputStep(createMockArgs('thread-1'));

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.message).toContain('loaded');

      // After searching, the matched tools should be active on the next step.
      const next = await processor.processInputStep(createMockArgs('thread-1'));
      for (const r of searchResult.results) {
        expect(next.tools?.[r.name]).toBeDefined();
      }
    });

    it('should keep activated tools scoped to their thread', async () => {
      const processor = createAutoLoadProcessor();

      const resultA = await processor.processInputStep(createMockArgs('thread-A'));
      const searchA = await resultA.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      expect(searchA.results.length).toBeGreaterThan(0);

      // A different thread should not see thread-A's activated tools.
      const resultB = await processor.processInputStep(createMockArgs('thread-B'));
      for (const r of searchA.results) {
        expect(resultB.tools?.[r.name]).toBeUndefined();
      }
    });

    it('should keep the cacheable prefix stable: meta-tool first, activated tools appended last', async () => {
      const processor = createAutoLoadProcessor();

      // Activate a tool, then inspect the merged tool order on the following step.
      const first = await processor.processInputStep(createMockArgs('thread-cache'));
      await first.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);

      const next = await processor.processInputStep(
        createMockArgs('thread-cache', { existing_tool: createMockTool('existing_tool', 'Always available') }),
      );

      const keys = Object.keys(next.tools ?? {});
      // search_tools stays first (stable prefix anchor).
      expect(keys[0]).toBe('search_tools');
      // load_tool is never injected in this mode.
      expect(keys).not.toContain('load_tool');
      // The always-available tool precedes the dynamically activated ones (appended last).
      const existingIdx = keys.indexOf('existing_tool');
      const activatedIdx = keys.indexOf('weather_forecast');
      expect(existingIdx).toBeGreaterThanOrEqual(0);
      expect(activatedIdx).toBeGreaterThan(existingIdx);
    });

    it('should report when matches were already loaded on a repeat search', async () => {
      const processor = createAutoLoadProcessor();
      const result = await processor.processInputStep(createMockArgs('thread-repeat'));

      const first = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      expect(first.message).toContain('loaded');

      const second = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      expect(second.message).toContain('already loaded');
    });

    it('should return an empty result without activating anything when nothing matches', async () => {
      const processor = createAutoLoadProcessor();
      const result = await processor.processInputStep(createMockArgs('thread-empty'));

      const searchResult = await result.tools?.search_tools!.execute?.(
        { query: 'zzz_nonexistent_capability' },
        undefined,
      );

      expect(searchResult.results).toEqual([]);
      expect(searchResult.message).toContain('No tools found');

      const next = await processor.processInputStep(createMockArgs('thread-empty'));
      // Only the meta-tool should be present; nothing got activated.
      expect(Object.keys(next.tools ?? {})).toEqual(['search_tools']);
    });

    it('activates tools across in-memory and context storage modes', async () => {
      for (const storage of ['in-memory', 'context'] as const) {
        const processor = new ToolSearchProcessor({
          tools: {
            weather_forecast: createMockTool('weather_forecast', 'Get weather forecast for a location'),
          },
          search: { autoLoad: true },
          storage,
        });

        const result = await processor.processInputStep(createMockArgs('thread-auto'));
        expect(result.tools?.load_tool).toBeUndefined();

        const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
        expect(searchResult.results.length).toBeGreaterThan(0);

        const next = await processor.processInputStep(createMockArgs('thread-auto'));
        expect(next.tools?.weather_forecast).toBeDefined();
      }
    });
  });

  describe('includeResolvedTools', () => {
    it('should search and load tools that exist only in args.tools when enabled', async () => {
      const mcpTool = createMockTool('mcp_github_create_issue', 'Create GitHub issue via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
      });

      const args = createMockArgs('thread-mcp', { mcp_github_create_issue: mcpTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.mcp_github_create_issue).toBeUndefined();

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(searchResult.results.map(r => r.name)).toContain('mcp_github_create_issue');

      const loadResult = await result.tools?.load_tool!.execute?.({ toolName: 'mcp_github_create_issue' }, undefined);
      expect(loadResult.success).toBe(true);

      const next = await processor.processInputStep(args);
      expect(next.tools?.mcp_github_create_issue).toBe(mcpTool);
    });

    it('should keep default behavior when includeResolvedTools is false', async () => {
      const mcpTool = createMockTool('mcp_github_create_issue', 'Create GitHub issue via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: false,
      });

      const args = createMockArgs('thread-mcp-default', { mcp_github_create_issue: mcpTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.mcp_github_create_issue).toBe(mcpTool);

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(searchResult.results.map(r => r.name)).not.toContain('mcp_github_create_issue');
    });

    it('should combine constructor tools and resolved tools in search', async () => {
      const mcpTool = createMockTool('mcp_send_email', 'Send email via MCP');
      const processor = new ToolSearchProcessor({
        tools: {
          weather_forecast: createMockTool('weather_forecast', 'Get weather forecast'),
        },
        includeResolvedTools: true,
      });

      const args = createMockArgs('thread-mixed', { mcp_send_email: mcpTool });
      const result = await processor.processInputStep(args);

      const weatherSearch = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      expect(weatherSearch.results.map(r => r.name)).toContain('weather_forecast');

      const emailSearch = await result.tools?.search_tools!.execute?.({ query: 'email' }, undefined);
      expect(emailSearch.results.map(r => r.name)).toContain('mcp_send_email');
    });

    it('should apply filter to resolved tools when includeResolvedTools is enabled', async () => {
      const mcpTool = createMockTool('mcp_github_create_issue', 'Create GitHub issue via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
        filter: ({ requestContext }) => requestContext?.get('allowMcp') === true,
      });

      const blockedArgs = createMockArgs('thread-mcp-filter', { mcp_github_create_issue: mcpTool });
      blockedArgs.requestContext?.set('allowMcp', false);
      const blockedResult = await processor.processInputStep(blockedArgs);
      const blockedSearch = await blockedResult.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(blockedSearch.results).toHaveLength(0);

      const allowedArgs = createMockArgs('thread-mcp-filter', { mcp_github_create_issue: mcpTool });
      allowedArgs.requestContext?.set('allowMcp', true);
      const allowedResult = await processor.processInputStep(allowedArgs);
      const allowedSearch = await allowedResult.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(allowedSearch.results.map(r => r.name)).toContain('mcp_github_create_issue');
    });

    it('should search and load CoreTool-shaped resolved tools (post makeCoreTool)', async () => {
      const coreTool = createMockCoreTool('mcp_github_create_issue', 'Create GitHub issue via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
      });

      const args = createMockArgs('thread-mcp-core', { mcp_github_create_issue: coreTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.mcp_github_create_issue).toBeUndefined();

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(searchResult.results.map(r => r.name)).toContain('mcp_github_create_issue');

      const loadResult = await result.tools?.load_tool!.execute?.({ toolName: 'mcp_github_create_issue' }, undefined);
      expect(loadResult.success).toBe(true);

      const next = await processor.processInputStep(args);
      expect(next.tools?.mcp_github_create_issue).toBe(coreTool);
    });

    it('should resolve loaded resolved tools via getLoadedToolsForRequestContext when stepArgs are provided', async () => {
      const coreTool = createMockCoreTool('mcp_send_email', 'Send email via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
      });

      const args = createMockArgs('thread-loaded-resolved', { mcp_send_email: coreTool });
      const result = await processor.processInputStep(args);
      await result.tools!.load_tool!.execute!({ toolName: 'mcp_send_email' }, undefined);

      const loaded = await processor.getLoadedToolsForRequestContext({
        stepArgs: args,
        requestContext: args.requestContext,
      });

      expect(loaded.mcp_send_email).toBe(coreTool);
    });

    it('should auto-load resolved tools from search when autoLoad is enabled', async () => {
      const mcpTool = createMockTool('mcp_weather_forecast', 'Get weather forecast via MCP');
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
        search: { autoLoad: true },
      });

      const args = createMockArgs('thread-mcp-autoload', { mcp_weather_forecast: mcpTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.load_tool).toBeUndefined();
      expect(result.tools?.mcp_weather_forecast).toBeUndefined();

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'weather' }, undefined);
      expect(searchResult.results.map(r => r.name)).toContain('mcp_weather_forecast');

      const next = await processor.processInputStep(args);
      expect(next.tools?.mcp_weather_forecast).toBe(mcpTool);
    });

    it('should not let resolved tools from prior requests pollute search results', async () => {
      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
        search: { topK: 5 },
      });

      const fillerTools: Record<string, ReturnType<typeof createMockTool>> = {};
      for (let i = 0; i < 20; i++) {
        fillerTools[`mcp_filler_${i}`] = createMockTool(`mcp_filler_${i}`, `GitHub related filler tool number ${i}`);
      }

      const argsA = createMockArgs('thread-a', fillerTools);
      await processor.processInputStep(argsA);

      const targetTool = createMockTool('mcp_target_create_issue', 'Create GitHub issue via MCP');
      const argsB = createMockArgs('thread-b', { mcp_target_create_issue: targetTool });
      const resultB = await processor.processInputStep(argsB);

      const searchResult = await resultB.tools?.search_tools!.execute?.({ query: 'github issue' }, undefined);
      expect(searchResult.results.map(r => r.name)).toContain('mcp_target_create_issue');
    });

    it('should ignore resolved entries without a string id when includeResolvedTools is enabled', async () => {
      const mcpTool = createMockTool('mcp_indexed', 'Indexed MCP tool');
      const clientTool = {
        description: 'Client tool without id',
        parameters: {},
        execute: async () => ({}),
      };

      const processor = new ToolSearchProcessor({
        tools: {},
        includeResolvedTools: true,
      });

      const args = createMockArgs('thread-no-id', { mcp_indexed: mcpTool, client_tool: clientTool });
      const result = await processor.processInputStep(args);

      expect(result.tools?.client_tool).toBeUndefined();
      expect(result.tools?.mcp_indexed).toBeUndefined();

      const searchResult = await result.tools?.search_tools!.execute?.({ query: 'indexed' }, undefined);
      expect(searchResult.results.map(r => r.name)).toContain('mcp_indexed');
      expect(searchResult.results.map(r => r.name)).not.toContain('client_tool');
    });
  });
});
