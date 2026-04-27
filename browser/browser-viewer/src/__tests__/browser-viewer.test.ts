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
  });
});
