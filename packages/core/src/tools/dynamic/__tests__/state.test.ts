import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ToolExecutionContext } from '../../types';
import { LoadedToolsStateManager, clearLoadedToolsCache, getLoadedToolNames } from '../state';

describe('LoadedToolsStateManager', () => {
  let stateManager: LoadedToolsStateManager;

  beforeEach(() => {
    stateManager = new LoadedToolsStateManager();
    clearLoadedToolsCache();
  });

  describe('with in-memory cache (no memory configured)', () => {
    const createContext = (threadId?: string): ToolExecutionContext => ({
      agent: threadId ? { threadId, toolCallId: 'test', messages: [], suspend: vi.fn() } : undefined,
    });

    it('should return empty array initially', async () => {
      const context = createContext('thread-1');
      const tools = await stateManager.getLoadedToolNames(context);

      expect(tools).toEqual([]);
    });

    it('should add a tool to loaded set', async () => {
      const context = createContext('thread-1');

      await stateManager.addLoadedTool(context, 'weather');

      const tools = await stateManager.getLoadedToolNames(context);
      expect(tools).toContain('weather');
    });

    it('should track multiple tools', async () => {
      const context = createContext('thread-1');

      await stateManager.addLoadedTool(context, 'weather');
      await stateManager.addLoadedTool(context, 'calendar');
      await stateManager.addLoadedTool(context, 'email');

      const tools = await stateManager.getLoadedToolNames(context);
      expect(tools).toHaveLength(3);
      expect(tools).toContain('weather');
      expect(tools).toContain('calendar');
      expect(tools).toContain('email');
    });

    it('should not duplicate tools', async () => {
      const context = createContext('thread-1');

      await stateManager.addLoadedTool(context, 'weather');
      await stateManager.addLoadedTool(context, 'weather');
      await stateManager.addLoadedTool(context, 'weather');

      const tools = await stateManager.getLoadedToolNames(context);
      expect(tools).toHaveLength(1);
    });

    it('should isolate tools by threadId', async () => {
      const context1 = createContext('thread-1');
      const context2 = createContext('thread-2');

      await stateManager.addLoadedTool(context1, 'weather');
      await stateManager.addLoadedTool(context2, 'calendar');

      const tools1 = await stateManager.getLoadedToolNames(context1);
      const tools2 = await stateManager.getLoadedToolNames(context2);

      expect(tools1).toEqual(['weather']);
      expect(tools2).toEqual(['calendar']);
    });

    it('should use default key when no threadId', async () => {
      const context = createContext(undefined);

      await stateManager.addLoadedTool(context, 'weather');

      const tools = await stateManager.getLoadedToolNames(context);
      expect(tools).toContain('weather');
    });

    it('should correctly check if tool is loaded', async () => {
      const context = createContext('thread-1');

      await stateManager.addLoadedTool(context, 'weather');

      expect(await stateManager.isToolLoaded(context, 'weather')).toBe(true);
      expect(await stateManager.isToolLoaded(context, 'calendar')).toBe(false);
    });

    it('should clear loaded tools', async () => {
      const context = createContext('thread-1');

      await stateManager.addLoadedTool(context, 'weather');
      await stateManager.addLoadedTool(context, 'calendar');
      await stateManager.clearLoadedTools(context);

      const tools = await stateManager.getLoadedToolNames(context);
      expect(tools).toEqual([]);
    });

    it('should only clear tools for specific thread', async () => {
      const context1 = createContext('thread-1');
      const context2 = createContext('thread-2');

      await stateManager.addLoadedTool(context1, 'weather');
      await stateManager.addLoadedTool(context2, 'calendar');
      await stateManager.clearLoadedTools(context1);

      const tools1 = await stateManager.getLoadedToolNames(context1);
      const tools2 = await stateManager.getLoadedToolNames(context2);

      expect(tools1).toEqual([]);
      expect(tools2).toEqual(['calendar']);
    });
  });

  describe('with simple context object', () => {
    it('should work with simple threadId object', async () => {
      const simpleContext = { threadId: 'simple-thread' };

      // Use the exported helper function
      const tools = await getLoadedToolNames(simpleContext);
      expect(tools).toEqual([]);
    });
  });
});

describe('clearLoadedToolsCache', () => {
  let stateManager: LoadedToolsStateManager;

  beforeEach(() => {
    stateManager = new LoadedToolsStateManager();
    clearLoadedToolsCache();
  });

  it('should clear all cached tools across all threads', async () => {
    const context1: ToolExecutionContext = {
      agent: { threadId: 'thread-1', toolCallId: 'test', messages: [], suspend: vi.fn() },
    };
    const context2: ToolExecutionContext = {
      agent: { threadId: 'thread-2', toolCallId: 'test', messages: [], suspend: vi.fn() },
    };

    await stateManager.addLoadedTool(context1, 'weather');
    await stateManager.addLoadedTool(context2, 'calendar');

    clearLoadedToolsCache();

    const tools1 = await stateManager.getLoadedToolNames(context1);
    const tools2 = await stateManager.getLoadedToolNames(context2);

    expect(tools1).toEqual([]);
    expect(tools2).toEqual([]);
  });
});

describe('getLoadedToolNames helper', () => {
  beforeEach(() => {
    clearLoadedToolsCache();
  });

  it('should return empty array for new thread', async () => {
    const tools = await getLoadedToolNames({ threadId: 'new-thread' });
    expect(tools).toEqual([]);
  });

  it('should return tools from cache', async () => {
    const stateManager = new LoadedToolsStateManager();
    const context: ToolExecutionContext = {
      agent: { threadId: 'test-thread', toolCallId: 'test', messages: [], suspend: vi.fn() },
    };

    await stateManager.addLoadedTool(context, 'weather');

    const tools = await getLoadedToolNames({ threadId: 'test-thread' });
    expect(tools).toContain('weather');
  });
});
