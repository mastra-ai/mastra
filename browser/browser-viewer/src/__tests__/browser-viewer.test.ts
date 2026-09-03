import { describe, it, expect, vi } from 'vitest';
import { BrowserViewer } from '../browser-viewer';

describe('BrowserViewer', () => {
  describe('browser state', () => {
    it('getBrowserState returns null when no browser is running', async () => {
      const viewer = new BrowserViewer({ cli: 'browser-use' });
      expect(await viewer.getBrowserState()).toBeNull();
    });

    it('getCurrentUrl returns null when no browser is running', async () => {
      const viewer = new BrowserViewer({ cli: 'browser-use' });
      expect(await viewer.getCurrentUrl()).toBeNull();
    });

    it('getBrowserState delegates to the thread-aware state lookup', async () => {
      const viewer = new BrowserViewer({ cli: 'browser-use' });
      const state = {
        tabs: [
          { url: 'https://example.com', title: '', isActive: false },
          { url: 'https://mastra.ai', title: '', isActive: true },
        ],
        activeTabIndex: 1,
      };
      const spy = vi.spyOn(viewer as any, 'getBrowserStateForThread').mockReturnValue(state);

      expect(await viewer.getBrowserState('thread-1')).toEqual(state);
      expect(spy).toHaveBeenCalledWith('thread-1');
    });

    it('getCurrentUrl returns the active tab URL', async () => {
      const viewer = new BrowserViewer({ cli: 'browser-use' });
      vi.spyOn(viewer as any, 'getBrowserStateForThread').mockReturnValue({
        tabs: [
          { url: 'https://example.com', title: '', isActive: false },
          { url: 'https://mastra.ai', title: '', isActive: true },
        ],
        activeTabIndex: 1,
      });

      expect(await viewer.getCurrentUrl()).toBe('https://mastra.ai');
    });
  });

  describe('constructor', () => {
    it('defaults headless to true', () => {
      const viewer = new BrowserViewer({ cli: 'browser-use' });
      expect(viewer.headless).toBe(true);
    });

    it('respects headless: false', () => {
      const viewer = new BrowserViewer({ cli: 'browser-use', headless: false });
      expect(viewer.headless).toBe(false);
    });

    it('supports current and legacy Browserbase CLI config values', () => {
      expect(new BrowserViewer({ cli: 'browse' }).cli).toBe('browse');
      expect(new BrowserViewer({ cli: 'browse-cli' }).cli).toBe('browse-cli');
    });
  });
});
