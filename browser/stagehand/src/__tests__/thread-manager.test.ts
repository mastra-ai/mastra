/**
 * Tests for StagehandThreadManager
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStagehand, mockPage } = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://example.com'),
  };

  const mockContext = {
    activePage: vi.fn().mockReturnValue(mockPage),
    pages: vi.fn().mockReturnValue([mockPage]),
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockStagehand = {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    context: mockContext,
  };

  return { mockStagehand, mockPage };
});

vi.mock('@browserbasehq/stagehand', () => ({
  Stagehand: class MockStagehand {
    init = mockStagehand.init;
    close = mockStagehand.close;
    context = mockStagehand.context;
  },
}));

import { StagehandThreadManager } from '../thread-manager';

describe('StagehandThreadManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates manager with none isolation', () => {
      const manager = new StagehandThreadManager({
        isolation: 'none',
      });

      expect(manager.getIsolationMode()).toBe('none');
    });

    it('creates manager with browser isolation', () => {
      const manager = new StagehandThreadManager({
        isolation: 'browser',
      });

      expect(manager.getIsolationMode()).toBe('browser');
    });
  });

  describe('shared stagehand (none isolation)', () => {
    it('setStagehand stores the instance', () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });

      threadManager.setStagehand(mockStagehand as any);

      expect(threadManager.getSharedStagehand()).toBe(mockStagehand);
    });

    it('clearStagehand removes the instance', () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });

      threadManager.setStagehand(mockStagehand as any);
      threadManager.clearStagehand();

      expect(() => threadManager.getSharedStagehand()).toThrow('Stagehand not initialized');
    });

    it('getStagehandForThread returns shared instance', () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });

      threadManager.setStagehand(mockStagehand as any);

      expect(threadManager.getStagehandForThread('any-thread')).toBe(mockStagehand);
    });

    it('getPageForThread returns active page from shared instance', () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });

      threadManager.setStagehand(mockStagehand as any);

      expect(threadManager.getPageForThread('any-thread')).toBe(mockPage);
    });
  });

  describe('session management', () => {
    it('hasSession returns false initially', () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });

      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasSession returns false for none isolation (no session tracking)', async () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'none',
      });
      threadManager.setStagehand(mockStagehand as any);

      await threadManager.getManagerForThread('thread-1');

      // 'none' isolation uses shared instance, no session tracking
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });
  });

  describe('browser isolation mode', () => {
    it('creates dedicated stagehand for each thread', async () => {
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      expect(createStagehand).toHaveBeenCalledTimes(2);
    });

    it('hasSession returns true after getManagerForThread', async () => {
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasSession('thread-1')).toBe(true);
    });

    it('throws error if createStagehand not set', async () => {
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
      });

      await expect(threadManager.getManagerForThread('thread-1')).rejects.toThrow('createStagehand factory not set');
    });

    it('setCreateStagehand allows setting factory later', async () => {
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
      });

      threadManager.setCreateStagehand(createStagehand);
      await threadManager.getManagerForThread('thread-1');

      expect(createStagehand).toHaveBeenCalledTimes(1);
    });

    it('onBrowserCreated callback is called', async () => {
      const onBrowserCreated = vi.fn();
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
        onBrowserCreated,
      });

      await threadManager.getManagerForThread('thread-1');

      expect(onBrowserCreated).toHaveBeenCalledWith(mockStagehand, 'thread-1');
    });

    it('destroySession closes stagehand instance', async () => {
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.destroySession('thread-1');

      expect(mockStagehand.close).toHaveBeenCalled();
      expect(threadManager.hasSession('thread-1')).toBe(false);
    });

    it('hasActiveThreadStagehands returns true when instances exist', async () => {
      const createStagehand = vi.fn().mockResolvedValue(mockStagehand);
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      expect(threadManager.hasActiveThreadStagehands()).toBe(false);

      await threadManager.getManagerForThread('thread-1');

      expect(threadManager.hasActiveThreadStagehands()).toBe(true);
    });
  });

  describe('destroyAllSessions', () => {
    it('clears all sessions', async () => {
      const createStagehand = vi.fn().mockResolvedValue({
        ...mockStagehand,
        close: vi.fn().mockResolvedValue(undefined),
      });
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      await threadManager.getManagerForThread('thread-1');
      await threadManager.getManagerForThread('thread-2');

      await threadManager.destroyAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(threadManager.hasSession('thread-2')).toBe(false);
      expect(threadManager.hasActiveThreadStagehands()).toBe(false);
    });
  });

  describe('clearAllSessions', () => {
    it('clears session tracking without closing instances', async () => {
      const closeStagehand = vi.fn().mockResolvedValue(undefined);
      const createStagehand = vi.fn().mockResolvedValue({
        ...mockStagehand,
        close: closeStagehand,
      });
      const threadManager = new StagehandThreadManager({
        isolation: 'browser',
        createStagehand,
      });

      await threadManager.getManagerForThread('thread-1');
      threadManager.clearAllSessions();

      expect(threadManager.hasSession('thread-1')).toBe(false);
      expect(closeStagehand).not.toHaveBeenCalled();
    });
  });
});
