import { describe, it, expect } from 'vitest';
import { BrowserViewer } from '../browser-viewer';

describe('BrowserViewer', () => {
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
