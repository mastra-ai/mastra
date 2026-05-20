/**
 * Tests for AgentBrowserThreadManager
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockManager } = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockReturnValue(mockPage),
    newTab: vi.fn().mockResolvedValue({ index: 1, total: 2 }),
    switchTo: vi.fn().mockResolvedValue(undefined),
  };

  return { mockManager, mockPage };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class MockBrowserManager {
    launch = mockManager.launch;
    close = mockManager.close;
    getPage = mockManager.getPage;
    newTab = mockManager.newTab;
    switchTo = mockManager.switchTo;
  },
}));

import { AgentBrowserThreadManager } from '../thread-manager';

describe('AgentBrowserThreadManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates manager with shared scope', () => {
      const manager = new AgentBrowserThreadManager({
        scope: 'shared',
        browserConfig: {},
      });

      expect(manager.getScope()).toBe('shared');
    });

    it('creates manager with thread scope', () => {
      const manager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: {},
      });

      expect(manager.getScope()).toBe('thread');
    });
  });

  describe('shared manager (shared scope)', () => {
    it('setSharedManager stores the manager', () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'shared',
        browserConfig: {},
      });

      const fakeManager = { fake: true } as any;
      threadManager.setSharedManager(fakeManager);

      expect(threadManager.getExistingManagerForThread('any-thread')).toBe(fakeManager);
    });

    it('clearSharedManager removes the manager', () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'shared',
        browserConfig: {},
      });

      const fakeManager = { fake: true } as any;
      threadManager.setSharedManager(fakeManager);
      threadManager.clearSharedManager();

      expect(threadManager.getExistingManagerForThread('any-thread')).toBeNull();
    });
  });

  describe('session management', () => {
    it('hasSession returns false initially', () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'shared',
        browserConfig: {},
      });

      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasSession returns false for shared scope (no session tracking)', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'shared',
        browserConfig: {},
      });
      threadManager.setSharedManager({ fake: true } as any);

      await threadManager.getManagerForThread('thread-1');

      // 'shared' scope uses shared manager, no session tracking
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasSession returns true after getManagerForThread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasSession('thread-1')).toBe(true);
    });

    it('destroySession removes session in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      expect(threadManager.hasSession('thread-1')).toBe(true);

      await threadManager.destroySession('thread-1');
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('destroyAllSessions clears all sessions', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      expect(threadManager.hasSession('thread-1')).toBe(true);
      expect(threadManager.hasSession('thread-2')).toBe(true);

      await threadManager.destroyAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(threadManager.hasSession('thread-2')).toBe(false);
      expect(threadManager.hasActiveThreadManagers()).toBe(false);
    });
  });

  describe('browser state', () => {
    it('updateBrowserState stores state for thread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');

      const state = {
        tabs: [{ url: 'https://example.com', title: 'Example' }],
        activeTabIndex: 0,
      };
      threadManager.updateBrowserState('thread-1', state);

      // Session still exists after update
      expect(threadManager.hasSession('thread-1')).toBe(true);
    });

    it('clearSession clears session tracking', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');

      const state = {
        tabs: [{ url: 'https://example.com', title: 'Example' }],
        activeTabIndex: 0,
      };
      threadManager.updateBrowserState('thread-1', state);
      threadManager.clearSession('thread-1');

      // Session is cleared
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });
  });

  describe('thread scope mode', () => {
    it('creates dedicated manager for each thread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      // Each thread should have launched a browser
      expect(mockManager.launch).toHaveBeenCalledTimes(2);
    });

    it('hasActiveThreadManagers returns true when browsers exist', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      expect(threadManager.hasActiveThreadManagers()).toBe(false);

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasActiveThreadManagers()).toBe(true);
    });

    it('destroySession closes browser in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.destroySession('thread-1');

      expect(mockManager.close).toHaveBeenCalled();
      expect(threadManager.hasActiveThreadManagers()).toBe(false);
    });

    it('creates dedicated session for DEFAULT_THREAD_ID in thread scope', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      // Should create a session for DEFAULT_THREAD_ID without throwing
      await threadManager.getManagerForThread();

      expect(mockManager.launch).toHaveBeenCalledTimes(1);
      expect(threadManager.hasActiveThreadManagers()).toBe(true);
    });

    it('getPageForThread works with DEFAULT_THREAD_ID in thread scope', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      // Should not throw "Browser not launched"
      const page = await threadManager.getPageForThread();

      expect(page).toBeDefined();
      expect(mockManager.launch).toHaveBeenCalledTimes(1);
    });

    it('onBrowserCreated callback is called', async () => {
      const onBrowserCreated = vi.fn();
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
        onBrowserCreated,
      });

      await threadManager.getManagerForThread('thread-1');

      expect(onBrowserCreated).toHaveBeenCalledWith(expect.any(Object), 'thread-1');
    });
  });

  describe('clearAllSessions', () => {
    it('clears all sessions without closing browsers', async () => {
      const threadManager = new AgentBrowserThreadManager({
        scope: 'thread',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      threadManager.clearAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(threadManager.hasSession('thread-2')).toBe(false);
      expect(threadManager.hasActiveThreadManagers()).toBe(false);
      // close should NOT have been called
      expect(mockManager.close).not.toHaveBeenCalled();
    });
  });
});
