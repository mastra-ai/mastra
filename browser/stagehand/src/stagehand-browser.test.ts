import { describe, it, expect } from 'vitest';
import { StagehandBrowser } from './stagehand-browser';
import { createStagehandTools, STAGEHAND_TOOLS } from './tools';

describe('StagehandBrowser', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      const browser = new StagehandBrowser();
      expect(browser.name).toBe('StagehandBrowser');
      expect(browser.provider).toBe('browserbase/stagehand');
      expect(browser.id).toMatch(/^stagehand-\d+$/);
    });

    it('should create instance with custom config', () => {
      const browser = new StagehandBrowser({
        env: 'LOCAL',
        model: 'openai/gpt-4o',
        headless: true,
        verbose: 0,
      });
      expect(browser.name).toBe('StagehandBrowser');
    });

    it('should accept cdpUrl as string', () => {
      const browser = new StagehandBrowser({
        cdpUrl: 'ws://localhost:9222',
      });
      expect(browser.name).toBe('StagehandBrowser');
    });

    it('should accept cdpUrl as function', () => {
      const browser = new StagehandBrowser({
        cdpUrl: async () => 'ws://localhost:9222',
      });
      expect(browser.name).toBe('StagehandBrowser');
    });
  });

  describe('getTools', () => {
    it('should return 6 tools', () => {
      const browser = new StagehandBrowser();
      const tools = browser.getTools();
      expect(Object.keys(tools)).toHaveLength(6);
    });

    it('should include all expected tools', () => {
      const browser = new StagehandBrowser();
      const tools = browser.getTools();

      expect(tools[STAGEHAND_TOOLS.ACT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.EXTRACT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.OBSERVE]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.NAVIGATE]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.SCREENSHOT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.CLOSE]).toBeDefined();
    });
  });

  describe('createStagehandTools', () => {
    it('should return tools bound to browser instance', () => {
      const browser = new StagehandBrowser();
      const tools = createStagehandTools(browser);

      expect(Object.keys(tools)).toHaveLength(6);
      expect(tools[STAGEHAND_TOOLS.ACT].id).toBe('stagehand_act');
      expect(tools[STAGEHAND_TOOLS.EXTRACT].id).toBe('stagehand_extract');
      expect(tools[STAGEHAND_TOOLS.OBSERVE].id).toBe('stagehand_observe');
    });
  });
});

describe('STAGEHAND_TOOLS', () => {
  it('should have correct tool names', () => {
    expect(STAGEHAND_TOOLS.ACT).toBe('stagehand_act');
    expect(STAGEHAND_TOOLS.EXTRACT).toBe('stagehand_extract');
    expect(STAGEHAND_TOOLS.OBSERVE).toBe('stagehand_observe');
    expect(STAGEHAND_TOOLS.NAVIGATE).toBe('stagehand_navigate');
    expect(STAGEHAND_TOOLS.SCREENSHOT).toBe('stagehand_screenshot');
    expect(STAGEHAND_TOOLS.CLOSE).toBe('stagehand_close');
  });
});
