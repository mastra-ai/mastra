import type { MastraBrowser } from '@mastra/core/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInputMessage } from '../input-handler.js';

describe('handleInputMessage', () => {
  let mockToolset: MastraBrowser;
  let getToolset: (agentId: string) => MastraBrowser | undefined;

  beforeEach(() => {
    mockToolset = {
      injectMouseEvent: vi.fn().mockResolvedValue(undefined),
      injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
      ensureReady: vi.fn().mockResolvedValue(undefined),
      getCurrentUrl: vi.fn().mockReturnValue('about:blank'),
      getLastUrl: vi.fn().mockReturnValue('https://example.com'),
      getLastBrowserState: vi.fn().mockReturnValue({ tabs: [{ url: 'https://example.com' }], activeTabIndex: 0 }),
      setCurrentThread: vi.fn(),
      navigateTo: vi.fn().mockResolvedValue(undefined),
    } as unknown as MastraBrowser;

    getToolset = vi.fn().mockReturnValue(mockToolset);
  });

  describe('message parsing', () => {
    it('should silently ignore invalid JSON', () => {
      handleInputMessage('not json', getToolset, 'agent-1');
      expect(getToolset).not.toHaveBeenCalled();
    });

    it('should silently ignore messages without type field', () => {
      handleInputMessage('{"foo": "bar"}', getToolset, 'agent-1');
      expect(mockToolset.injectMouseEvent).not.toHaveBeenCalled();
      expect(mockToolset.injectKeyboardEvent).not.toHaveBeenCalled();
    });

    it('should silently ignore messages with unknown type', () => {
      handleInputMessage('{"type": "unknown"}', getToolset, 'agent-1');
      expect(mockToolset.injectMouseEvent).not.toHaveBeenCalled();
      expect(mockToolset.injectKeyboardEvent).not.toHaveBeenCalled();
    });

    it('should silently skip if no toolset available', () => {
      const noToolset = vi.fn().mockReturnValue(undefined);
      handleInputMessage('{"type": "mouse", "eventType": "mouseMoved", "x": 10, "y": 20}', noToolset, 'agent-1');
      expect(noToolset).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('mouse input', () => {
    it('should inject mouse move events', async () => {
      const message = JSON.stringify({
        type: 'mouse',
        eventType: 'mouseMoved',
        x: 100,
        y: 200,
      });

      handleInputMessage(message, getToolset, 'agent-1');

      // Wait for async handler
      await vi.waitFor(() => {
        expect(mockToolset.injectMouseEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mouseMoved',
            x: 100,
            y: 200,
          }),
          undefined, // threadId
        );
      });
    });

    it('should inject mouse click events with button and clickCount', async () => {
      const message = JSON.stringify({
        type: 'mouse',
        eventType: 'mousePressed',
        x: 50,
        y: 75,
        button: 'left',
        clickCount: 1,
      });

      handleInputMessage(message, getToolset, 'agent-1');

      await vi.waitFor(() => {
        expect(mockToolset.injectMouseEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mousePressed',
            x: 50,
            y: 75,
            button: 'left',
            clickCount: 1,
          }),
          undefined, // threadId
        );
      });
    });

    it('should inject scroll events with delta values', async () => {
      const message = JSON.stringify({
        type: 'mouse',
        eventType: 'mouseWheel',
        x: 100,
        y: 100,
        deltaX: 0,
        deltaY: -120,
      });

      handleInputMessage(message, getToolset, 'agent-1');

      await vi.waitFor(() => {
        expect(mockToolset.injectMouseEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mouseWheel',
            deltaX: 0,
            deltaY: -120,
          }),
          undefined, // threadId
        );
      });
    });
  });

  describe('keyboard input', () => {
    it('should inject keyDown events', async () => {
      const message = JSON.stringify({
        type: 'keyboard',
        eventType: 'keyDown',
        key: 'a',
      });

      handleInputMessage(message, getToolset, 'agent-1');

      await vi.waitFor(() => {
        expect(mockToolset.injectKeyboardEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'keyDown',
            key: 'a',
          }),
          undefined, // threadId
        );
      });
    });

    it('should inject char events with text', async () => {
      const message = JSON.stringify({
        type: 'keyboard',
        eventType: 'char',
        text: 'a',
      });

      handleInputMessage(message, getToolset, 'agent-1');

      await vi.waitFor(() => {
        expect(mockToolset.injectKeyboardEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'char',
            text: 'a',
          }),
          undefined, // threadId
        );
      });
    });

    it('should handle special keys with virtual key codes', async () => {
      const message = JSON.stringify({
        type: 'keyboard',
        eventType: 'keyDown',
        key: 'Enter',
      });

      handleInputMessage(message, getToolset, 'agent-1');

      await vi.waitFor(() => {
        expect(mockToolset.injectKeyboardEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'keyDown',
            key: 'Enter',
            windowsVirtualKeyCode: 13,
          }),
          undefined, // threadId
        );
      });
    });
  });
});
