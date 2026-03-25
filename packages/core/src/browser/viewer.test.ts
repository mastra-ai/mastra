/**
 * BrowserViewer tests
 *
 * These are unit tests that don't require a real browser connection.
 * For integration tests, see the workspace-browser-agent example.
 */

import { describe, it, expect } from 'vitest';
import { BrowserViewer } from './viewer';

describe('BrowserViewer', () => {
  describe('constructor', () => {
    it('creates instance with string cdpUrl', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
      expect(viewer.isConnected).toBe(false);
    });

    it('creates instance with function cdpUrl', () => {
      const viewer = new BrowserViewer({
        cdpUrl: async () => 'ws://localhost:9222/devtools/browser/xxx',
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
    });

    it('creates instance with CLI provider (built-in)', () => {
      const viewer = new BrowserViewer({
        cli: 'agent-browser',
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
      expect(viewer.cli).toBe('agent-browser');
    });

    it('creates instance with CLI provider (custom)', () => {
      const viewer = new BrowserViewer({
        cli: {
          getCdpUrlCommand: 'my-browser get cdp-url',
          checkCommand: 'my-browser --version',
          installCommand: 'npm install -g my-browser',
        },
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
      expect(viewer.cli).toEqual({
        getCdpUrlCommand: 'my-browser get cdp-url',
        checkCommand: 'my-browser --version',
        installCommand: 'npm install -g my-browser',
      });
    });

    it('creates instance with screencast options', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
        screencast: {
          quality: 50,
          maxWidth: 800,
          maxHeight: 600,
        },
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
    });

    it('creates instance with autoReconnect option', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
        autoReconnect: true,
        reconnectDelay: 2000,
      });
      expect(viewer).toBeInstanceOf(BrowserViewer);
    });
  });

  describe('CLI provider', () => {
    it('getInstallCommand returns correct command for built-in provider', () => {
      const viewer = new BrowserViewer({ cli: 'agent-browser' });
      expect(viewer.getInstallCommand()).toBe('npm install -g agent-browser');
    });

    it('getInstallCommand returns custom command for custom provider', () => {
      const viewer = new BrowserViewer({
        cli: { getCdpUrlCommand: 'test', installCommand: 'custom-install' },
      });
      expect(viewer.getInstallCommand()).toBe('custom-install');
    });

    it('getInstallCommand returns undefined when no CLI configured', () => {
      const viewer = new BrowserViewer({ cdpUrl: 'ws://localhost:9222/...' });
      expect(viewer.getInstallCommand()).toBeUndefined();
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      expect(viewer.isConnected).toBe(false);
    });
  });

  describe('CdpSessionProvider implementation', () => {
    it('implements isBrowserRunning()', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      expect(viewer.isBrowserRunning()).toBe(false);
    });

    it('getCdpSession() throws when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      await expect(viewer.getCdpSession()).rejects.toThrow('Not connected');
    });
  });

  describe('getCurrentUrl', () => {
    it('returns null when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      const url = await viewer.getCurrentUrl();
      expect(url).toBeNull();
    });
  });

  describe('getTitle', () => {
    it('returns null when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      const title = await viewer.getTitle();
      expect(title).toBeNull();
    });
  });

  describe('getLastUrl', () => {
    it('returns undefined when never connected', () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      expect(viewer.getLastUrl()).toBeUndefined();
    });
  });

  describe('startScreencast', () => {
    it('throws when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      await expect(viewer.startScreencast()).rejects.toThrow('Not connected');
    });
  });

  describe('injectMouseEvent', () => {
    it('throws when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      await expect(viewer.injectMouseEvent({ type: 'mousePressed', x: 100, y: 100 })).rejects.toThrow('Not connected');
    });
  });

  describe('injectKeyboardEvent', () => {
    it('throws when not connected', async () => {
      const viewer = new BrowserViewer({
        cdpUrl: 'ws://localhost:9222/devtools/browser/xxx',
      });
      await expect(viewer.injectKeyboardEvent({ type: 'keyDown', key: 'a' })).rejects.toThrow('Not connected');
    });
  });
});
