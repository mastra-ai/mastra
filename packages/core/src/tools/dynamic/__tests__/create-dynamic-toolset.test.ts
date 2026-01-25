import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createTool, Tool } from '../../tool';
import type { ToolExecutionContext } from '../../types';
import { createDynamicToolSet } from '../create-dynamic-toolset';
import { clearLoadedToolsCache } from '../state';

// Helper to create mock tools
function createMockTool(id: string, description: string): Tool {
  return createTool({
    id,
    description,
    execute: async () => ({ success: true, toolId: id }),
  }) as unknown as Tool;
}

// Helper to create a mock execution context
function createMockContext(threadId?: string): ToolExecutionContext {
  return {
    agent: threadId ? { threadId, toolCallId: 'test-call', messages: [], suspend: vi.fn() } : undefined,
  };
}

describe('createDynamicToolSet', () => {
  beforeEach(() => {
    clearLoadedToolsCache();
  });

  describe('initialization', () => {
    it('should create searchTool and loadTool', () => {
      const { searchTool, loadTool } = createDynamicToolSet({
        tools: {},
      });

      expect(searchTool).toBeDefined();
      expect(loadTool).toBeDefined();
      expect(searchTool.id).toBe('search_tools');
      expect(loadTool.id).toBe('load_tool');
    });

    it('should accept custom tool names', () => {
      const { searchTool, loadTool } = createDynamicToolSet({
        tools: {},
        searchToolName: 'find_capabilities',
        loadToolName: 'activate_tool',
      });

      expect(searchTool.id).toBe('find_capabilities');
      expect(loadTool.id).toBe('activate_tool');
    });

    it('should accept tools as a record', () => {
      const { registry } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      expect(registry.size()).toBe(2);
    });

    it('should accept tools as an array', () => {
      const { registry } = createDynamicToolSet({
        tools: [createMockTool('weather', 'Get weather'), createMockTool('calendar', 'Manage calendar')],
      });

      expect(registry.size()).toBe(2);
    });

    it('should expose the registry', () => {
      const { registry } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      expect(registry.size()).toBe(1);
      expect(registry.get('weather')).toBeDefined();
    });
  });

  describe('searchTool', () => {
    it('should find matching tools', async () => {
      const { searchTool } = createDynamicToolSet({
        tools: {
          github_create_issue: createMockTool('github_create_issue', 'Create a GitHub issue'),
          github_create_pr: createMockTool('github_create_pr', 'Create a pull request'),
          weather: createMockTool('weather', 'Get weather forecast'),
        },
      });

      const result = await searchTool.execute?.({ query: 'github' }, undefined);

      expect(result).toBeDefined();
      expect(result.results.length).toBe(2);
      expect(result.results.map((r: any) => r.name)).toContain('github_create_issue');
      expect(result.results.map((r: any) => r.name)).toContain('github_create_pr');
    });

    it('should return message when no matches found', async () => {
      const { searchTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const result = await searchTool.execute?.({ query: 'database' }, undefined);

      expect(result.results).toEqual([]);
      expect(result.message).toContain('No tools found');
    });

    it('should respect topK configuration', async () => {
      const { searchTool } = createDynamicToolSet({
        tools: {
          tool1: createMockTool('tool1', 'Create something'),
          tool2: createMockTool('tool2', 'Create another'),
          tool3: createMockTool('tool3', 'Create more'),
          tool4: createMockTool('tool4', 'Create even more'),
        },
        search: { topK: 2 },
      });

      const result = await searchTool.execute?.({ query: 'create' }, undefined);

      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should include helpful message with results', async () => {
      const { searchTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const result = await searchTool.execute?.({ query: 'weather' }, undefined);

      expect(result.message).toContain('Found');
      expect(result.message).toContain('load_tool');
    });
  });

  describe('loadTool', () => {
    it('should successfully load an existing tool', async () => {
      const { loadTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const context = createMockContext('thread-1');
      const result = await loadTool.execute?.({ toolName: 'weather' }, context);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('weather');
      expect(result.message).toContain('loaded successfully');
    });

    it('should return error for non-existent tool', async () => {
      const { loadTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const context = createMockContext('thread-1');
      const result = await loadTool.execute?.({ toolName: 'nonexistent' }, context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should suggest similar tool names', async () => {
      const { loadTool } = createDynamicToolSet({
        tools: {
          weather_forecast: createMockTool('weather_forecast', 'Get weather'),
          weather_current: createMockTool('weather_current', 'Current weather'),
        },
      });

      const context = createMockContext('thread-1');
      const result = await loadTool.execute?.({ toolName: 'weather' }, context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Did you mean');
    });

    it('should indicate when tool is already loaded', async () => {
      const { loadTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const context = createMockContext('thread-1');

      // Load once
      await loadTool.execute?.({ toolName: 'weather' }, context);

      // Load again
      const result = await loadTool.execute?.({ toolName: 'weather' }, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already loaded');
    });

    it('should work without context', async () => {
      const { loadTool } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      // Call without context
      const result = await loadTool.execute?.({ toolName: 'weather' }, undefined);

      expect(result.success).toBe(true);
    });
  });

  describe('getLoadedTools', () => {
    it('should return empty object initially', async () => {
      const { getLoadedTools } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const loaded = await getLoadedTools({ threadId: 'thread-1' });

      expect(Object.keys(loaded)).toHaveLength(0);
    });

    it('should return loaded tools after load', async () => {
      const { loadTool, getLoadedTools } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const context = createMockContext('thread-1');
      await loadTool.execute?.({ toolName: 'weather' }, context);

      const loaded = await getLoadedTools({ threadId: 'thread-1' });

      expect(Object.keys(loaded)).toHaveLength(1);
      expect(loaded.weather).toBeDefined();
    });

    it('should return multiple loaded tools', async () => {
      const { loadTool, getLoadedTools } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
          email: createMockTool('email', 'Send email'),
        },
      });

      const context = createMockContext('thread-1');
      await loadTool.execute?.({ toolName: 'weather' }, context);
      await loadTool.execute?.({ toolName: 'calendar' }, context);

      const loaded = await getLoadedTools({ threadId: 'thread-1' });

      expect(Object.keys(loaded)).toHaveLength(2);
      expect(loaded.weather).toBeDefined();
      expect(loaded.calendar).toBeDefined();
      expect(loaded.email).toBeUndefined();
    });

    it('should isolate loaded tools by thread', async () => {
      const { loadTool, getLoadedTools } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
          calendar: createMockTool('calendar', 'Manage calendar'),
        },
      });

      const context1 = createMockContext('thread-1');
      const context2 = createMockContext('thread-2');

      await loadTool.execute?.({ toolName: 'weather' }, context1);
      await loadTool.execute?.({ toolName: 'calendar' }, context2);

      const loaded1 = await getLoadedTools({ threadId: 'thread-1' });
      const loaded2 = await getLoadedTools({ threadId: 'thread-2' });

      expect(Object.keys(loaded1)).toEqual(['weather']);
      expect(Object.keys(loaded2)).toEqual(['calendar']);
    });

    it('should accept ToolExecutionContext', async () => {
      const { loadTool, getLoadedTools } = createDynamicToolSet({
        tools: {
          weather: createMockTool('weather', 'Get weather'),
        },
      });

      const context = createMockContext('thread-1');
      await loadTool.execute?.({ toolName: 'weather' }, context);

      // Pass full context instead of simple object
      const loaded = await getLoadedTools(context);

      expect(Object.keys(loaded)).toHaveLength(1);
    });
  });

  describe('full workflow', () => {
    it('should support complete search -> load -> use flow', async () => {
      const weatherTool = createMockTool('weather_forecast', 'Get weather forecast for any location');
      const calendarTool = createMockTool('calendar_schedule', 'Schedule calendar events');

      const { searchTool, loadTool, getLoadedTools } = createDynamicToolSet({
        tools: {
          weather_forecast: weatherTool,
          calendar_schedule: calendarTool,
        },
      });

      const context = createMockContext('workflow-thread');

      // Step 1: Search for weather tools
      const searchResult = await searchTool.execute?.({ query: 'weather forecast' }, context);
      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].name).toBe('weather_forecast');

      // Step 2: Load the found tool
      const loadResult = await loadTool.execute?.({ toolName: 'weather_forecast' }, context);
      expect(loadResult.success).toBe(true);

      // Step 3: Get loaded tools for next agent turn
      const loadedTools = await getLoadedTools({ threadId: 'workflow-thread' });
      expect(loadedTools.weather_forecast).toBeDefined();
      expect(loadedTools.weather_forecast.id).toBe('weather_forecast');

      // Step 4: Execute the loaded tool
      const toolResult = await loadedTools.weather_forecast.execute?.({}, undefined);
      expect(toolResult.success).toBe(true);
    });
  });
});
