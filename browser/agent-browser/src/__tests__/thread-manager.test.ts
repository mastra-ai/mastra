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
    it('creates manager with none isolation', () => {
      const manager = new AgentBrowserThreadManager({
        isolation: 'none',
        browserConfig: {},
      });

      expect(manager.getIsolationMode()).toBe('none');
    });

    it('creates manager with browser isolation', () => {
      const manager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: {},
      });

      expect(manager.getIsolationMode()).toBe('browser');
    });
  });

  describe('shared manager (none isolation)', () => {
    it('setSharedManager stores the manager', () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'none',
        browserConfig: {},
      });

      const fakeManager = { fake: true } as any;
      threadManager.setSharedManager(fakeManager);

      expect(threadManager.getExistingManagerForThread('any-thread')).toBe(fakeManager);
    });

    it('clearSharedManager removes the manager', () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'none',
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
        isolation: 'none',
        browserConfig: {},
      });

      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasSession returns false for none isolation (no session tracking)', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'none',
        browserConfig: {},
      });
      threadManager.setSharedManager({ fake: true } as any);

      await threadManager.getManagerForThread('thread-1');

      // 'none' isolation uses shared manager, no session tracking
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasSession returns true after getManagerForThread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasSession('thread-1')).toBe(true);
    });

    it('destroySession removes session in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      expect(threadManager.hasSession('thread-1')).toBe(true);

      await threadManager.destroySession('thread-1');
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('destroyAllSessions clears all sessions', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'none',
        browserConfig: {},
      });
      threadManager.setSharedManager({ fake: true } as any);

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      await threadManager.destroyAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(threadManager.hasSession('thread-2')).toBe(false);
    });
  });

  describe('browser state', () => {
    it('updateBrowserState stores state for thread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
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
        isolation: 'browser',
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

  describe('browser isolation mode', () => {
    it('creates dedicated manager for each thread in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      // Each thread should have launched a browser
      expect(mockManager.launch).toHaveBeenCalledTimes(2);
    });

    it('hasActiveThreadBrowsers returns true when browsers exist', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      expect(threadManager.hasActiveThreadBrowsers()).toBe(false);

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasActiveThreadBrowsers()).toBe(true);
    });

    it('destroySession closes browser in browser mode', async () => {
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.destroySession('thread-1');

      expect(mockManager.close).toHaveBeenCalled();
      expect(threadManager.hasActiveThreadBrowsers()).toBe(false);
    });

    it('onBrowserCreated callback is called', async () => {
      const onBrowserCreated = vi.fn();
      const threadManager = new AgentBrowserThreadManager({
        isolation: 'browser',
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
        isolation: 'browser',
        browserConfig: { headless: true },
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      threadManager.clearAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(threadManager.hasSession('thread-2')).toBe(false);
      expect(threadManager.hasActiveThreadBrowsers()).toBe(false);
      // close should NOT have been called
      expect(mockManager.close).not.toHaveBeenCalled();
    });
  });
});
