import type { MastraBrowser } from '@mastra/core/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserStreamWebSocket } from '../types.js';
import { ViewerRegistry } from '../viewer-registry.js';

describe('ViewerRegistry', () => {
  let registry: ViewerRegistry;
  let mockWs1: BrowserStreamWebSocket;
  let mockWs2: BrowserStreamWebSocket;
  let mockToolset: MastraBrowser;
  let getToolset: (agentId: string) => MastraBrowser | undefined;

  beforeEach(() => {
    registry = new ViewerRegistry();

    mockWs1 = { send: vi.fn() };
    mockWs2 = { send: vi.fn() };

    mockToolset = {
      isBrowserRunning: vi.fn().mockReturnValue(false),
      onBrowserReady: vi.fn().mockReturnValue(() => {}),
      onBrowserClosed: vi.fn().mockReturnValue(() => {}),
      startScreencastIfBrowserActive: vi.fn().mockResolvedValue(null),
      getCurrentUrl: vi.fn().mockReturnValue('about:blank'),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as MastraBrowser;

    getToolset = vi.fn().mockReturnValue(mockToolset);
  });

  describe('addViewer', () => {
    it('should add a viewer and track it', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      expect(registry.getViewerCount('agent-1')).toBe(1);
    });

    it('should add multiple viewers for the same agent', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.addViewer('agent-1', mockWs2, getToolset);
      expect(registry.getViewerCount('agent-1')).toBe(2);
    });

    it('should register browser ready callback on first viewer', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      expect(mockToolset.onBrowserReady).toHaveBeenCalled();
    });

    it('should register browser closed callback on first viewer', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      expect(mockToolset.onBrowserClosed).toHaveBeenCalled();
    });

    it('should not register callbacks again for subsequent viewers', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.addViewer('agent-1', mockWs2, getToolset);
      // Called only once despite two viewers
      expect(mockToolset.onBrowserReady).toHaveBeenCalledTimes(1);
      expect(mockToolset.onBrowserClosed).toHaveBeenCalledTimes(1);
    });

    it('should start screencast if browser is already running', async () => {
      (mockToolset.isBrowserRunning as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockToolset.startScreencastIfBrowserActive as ReturnType<typeof vi.fn>).mockResolvedValue({
        on: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      });

      await registry.addViewer('agent-1', mockWs1, getToolset);

      expect(mockToolset.startScreencastIfBrowserActive).toHaveBeenCalled();
    });
  });

  describe('removeViewer', () => {
    it('should remove a viewer', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.removeViewer('agent-1', mockWs1);
      expect(registry.getViewerCount('agent-1')).toBe(0);
    });

    it('should clean up callbacks when last viewer disconnects', async () => {
      const cleanupReady = vi.fn();
      const cleanupClosed = vi.fn();
      (mockToolset.onBrowserReady as ReturnType<typeof vi.fn>).mockReturnValue(cleanupReady);
      (mockToolset.onBrowserClosed as ReturnType<typeof vi.fn>).mockReturnValue(cleanupClosed);

      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.removeViewer('agent-1', mockWs1);

      expect(cleanupReady).toHaveBeenCalled();
      expect(cleanupClosed).toHaveBeenCalled();
    });

    it('should not clean up callbacks if other viewers remain', async () => {
      const cleanupReady = vi.fn();
      const cleanupClosed = vi.fn();
      (mockToolset.onBrowserReady as ReturnType<typeof vi.fn>).mockReturnValue(cleanupReady);
      (mockToolset.onBrowserClosed as ReturnType<typeof vi.fn>).mockReturnValue(cleanupClosed);

      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.addViewer('agent-1', mockWs2, getToolset);
      await registry.removeViewer('agent-1', mockWs1);

      expect(cleanupReady).not.toHaveBeenCalled();
      expect(cleanupClosed).not.toHaveBeenCalled();
      expect(registry.getViewerCount('agent-1')).toBe(1);
    });

    it('should handle removing non-existent viewer gracefully', async () => {
      // Should not throw
      await registry.removeViewer('non-existent', mockWs1);
      expect(registry.getViewerCount('non-existent')).toBe(0);
    });
  });

  describe('getViewerCount', () => {
    it('should return 0 for agent with no viewers', () => {
      expect(registry.getViewerCount('unknown-agent')).toBe(0);
    });
  });

  describe('hasActiveScreencast', () => {
    it('should return false when no screencast is active', () => {
      expect(registry.hasActiveScreencast('agent-1')).toBe(false);
    });

    it('should return true when screencast is active', async () => {
      (mockToolset.isBrowserRunning as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockToolset.startScreencastIfBrowserActive as ReturnType<typeof vi.fn>).mockResolvedValue({
        on: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
      });

      await registry.addViewer('agent-1', mockWs1, getToolset);

      expect(registry.hasActiveScreencast('agent-1')).toBe(true);
    });
  });

  describe('closeBrowserSession', () => {
    it('should broadcast browser_closed status', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.closeBrowserSession('agent-1');

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ status: 'browser_closed' }));
    });

    it('should stop active screencast', async () => {
      const mockStop = vi.fn().mockResolvedValue(undefined);
      (mockToolset.isBrowserRunning as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockToolset.startScreencastIfBrowserActive as ReturnType<typeof vi.fn>).mockResolvedValue({
        on: vi.fn(),
        stop: mockStop,
      });

      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.closeBrowserSession('agent-1');

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('broadcasting', () => {
    it('should broadcast to all viewers for an agent', async () => {
      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.addViewer('agent-1', mockWs2, getToolset);

      // Trigger a broadcast by closing browser session
      await registry.closeBrowserSession('agent-1');

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    it('should not broadcast to viewers of different agents', async () => {
      const getToolset2 = vi.fn().mockReturnValue({
        ...mockToolset,
        onBrowserReady: vi.fn().mockReturnValue(() => {}),
        onBrowserClosed: vi.fn().mockReturnValue(() => {}),
      });

      await registry.addViewer('agent-1', mockWs1, getToolset);
      await registry.addViewer('agent-2', mockWs2, getToolset2);

      await registry.closeBrowserSession('agent-1');

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ status: 'browser_closed' }));
      // mockWs2 should not receive agent-1's broadcast
      expect(mockWs2.send).not.toHaveBeenCalledWith(JSON.stringify({ status: 'browser_closed' }));
    });
  });
});
