import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mocks BEFORE vi.mock using vi.hoisted so they're available in the mock
const { mockPage, mockContext, mockStagehand, mockCdpSession } = vi.hoisted(() => {
  const mockCdpSession = {
    send: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
    off: vi.fn(),
  };

  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example Page'),
    goto: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    mainFrameId: vi.fn().mockReturnValue('main-frame-123'),
    getSessionForFrame: vi.fn().mockReturnValue(mockCdpSession),
  };

  const mockContext = {
    pages: vi.fn().mockReturnValue([mockPage]),
  };

  const mockStagehand = {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    context: mockContext,
    act: vi.fn().mockResolvedValue({
      success: true,
      message: 'Clicked button',
      actionDescription: 'Clicked submit button',
      actions: [{ selector: '#submit', description: 'Submit button' }],
    }),
    extract: vi.fn().mockResolvedValue({
      title: 'Page Title',
      price: '$99.99',
    }),
    observe: vi.fn().mockResolvedValue([
      { selector: '#btn1', description: 'Button 1', method: 'click' },
      { selector: '#btn2', description: 'Button 2', method: 'click' },
    ]),
  };

  return { mockPage, mockContext, mockStagehand, mockCdpSession };
});

vi.mock('@browserbasehq/stagehand', () => ({
  Stagehand: class MockStagehand {
    init = mockStagehand.init;
    close = mockStagehand.close;
    context = mockStagehand.context;
    act = mockStagehand.act;
    extract = mockStagehand.extract;
    observe = mockStagehand.observe;
  },
}));

// Import AFTER vi.mock
import { StagehandBrowser } from './stagehand-browser';
import { createStagehandTools, STAGEHAND_TOOLS } from './tools';

describe('StagehandBrowser', () => {
  let browser: StagehandBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    browser = new StagehandBrowser();
  });

  afterEach(async () => {
    if (browser.status === 'ready') {
      await browser.close();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(browser.name).toBe('StagehandBrowser');
      expect(browser.provider).toBe('browserbase/stagehand');
      expect(browser.id).toMatch(/^stagehand-\d+$/);
    });

    it('should start in pending status', () => {
      expect(browser.status).toBe('pending');
    });

    it('should create instance with custom config', () => {
      const customBrowser = new StagehandBrowser({
        env: 'LOCAL',
        model: 'openai/gpt-4o',
        headless: true,
        verbose: 0,
      });
      expect(customBrowser.name).toBe('StagehandBrowser');
    });

    it('should accept cdpUrl as string', () => {
      const customBrowser = new StagehandBrowser({
        cdpUrl: 'ws://localhost:9222',
      });
      expect(customBrowser.name).toBe('StagehandBrowser');
    });

    it('should accept cdpUrl as function', () => {
      const customBrowser = new StagehandBrowser({
        cdpUrl: async () => 'ws://localhost:9222',
      });
      expect(customBrowser.name).toBe('StagehandBrowser');
    });

    it('should accept Browserbase config', () => {
      const customBrowser = new StagehandBrowser({
        env: 'BROWSERBASE',
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
      });
      expect(customBrowser.name).toBe('StagehandBrowser');
    });
  });

  describe('lifecycle', () => {
    it('should launch successfully', async () => {
      await browser.launch();
      expect(browser.status).toBe('ready');
      expect(mockStagehand.init).toHaveBeenCalled();
    });

    it('should close successfully', async () => {
      await browser.launch();
      await browser.close();
      expect(browser.status).toBe('closed');
      expect(mockStagehand.close).toHaveBeenCalled();
    });

    it('should handle close when not launched', async () => {
      await browser.close();
      expect(browser.status).toBe('closed');
    });

    it('should report isBrowserRunning correctly', async () => {
      expect(browser.isBrowserRunning()).toBe(false);
      await browser.launch();
      expect(browser.isBrowserRunning()).toBe(true);
      await browser.close();
      expect(browser.isBrowserRunning()).toBe(false);
    });

    it('should detect externally closed browser and re-launch', async () => {
      await browser.launch();
      expect(browser.status).toBe('ready');
      expect(mockStagehand.init).toHaveBeenCalledTimes(1);

      // Simulate browser being externally closed
      mockPage.url.mockImplementationOnce(() => {
        throw new Error('Target page, context or browser has been closed');
      });

      // ensureReady should detect disconnection and re-launch
      await browser.ensureReady();
      expect(browser.status).toBe('ready');
      expect(mockStagehand.init).toHaveBeenCalledTimes(2);
    });

    it('should handle "Target closed" error during status check', async () => {
      await browser.launch();

      // Simulate disconnect error
      mockPage.url.mockImplementationOnce(() => {
        throw new Error('Target closed');
      });

      await browser.ensureReady();
      // Should have re-launched
      expect(mockStagehand.init).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTools', () => {
    it('should return 6 tools', () => {
      const tools = browser.getTools();
      expect(Object.keys(tools)).toHaveLength(6);
    });

    it('should include all expected tools', () => {
      const tools = browser.getTools();

      expect(tools[STAGEHAND_TOOLS.ACT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.EXTRACT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.OBSERVE]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.NAVIGATE]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.SCREENSHOT]).toBeDefined();
      expect(tools[STAGEHAND_TOOLS.CLOSE]).toBeDefined();
    });
  });

  describe('act', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should execute an action successfully', async () => {
      const result = await browser.act({
        instruction: 'Click the submit button',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Clicked button');
      expect(result.action).toBe('Clicked submit button');
      expect(result.url).toBe('https://example.com');
      expect(mockStagehand.act).toHaveBeenCalledWith('Click the submit button', {
        variables: undefined,
        timeout: undefined,
      });
    });

    it('should pass variables to act', async () => {
      await browser.act({
        instruction: 'Fill form with {{name}}',
        variables: { name: 'John' },
      });

      expect(mockStagehand.act).toHaveBeenCalledWith('Fill form with {{name}}', {
        variables: { name: 'John' },
        timeout: undefined,
      });
    });

    it('should pass timeout to act', async () => {
      await browser.act({
        instruction: 'Click button',
        timeout: 5000,
      });

      expect(mockStagehand.act).toHaveBeenCalledWith('Click button', {
        variables: undefined,
        timeout: 5000,
      });
    });

    it('should handle act failure gracefully', async () => {
      mockStagehand.act.mockRejectedValueOnce(new Error('Element not found'));

      const result = await browser.act({
        instruction: 'Click missing button',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('act_failed');
      expect(result.message).toBe('Element not found');
    });

    it('should detect browser disconnection during act and set status to closed', async () => {
      mockStagehand.act.mockRejectedValueOnce(new Error('Target page, context or browser has been closed'));

      const result = await browser.act({
        instruction: 'Click button',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('browser_closed');
      expect(browser.status).toBe('closed');
    });

    it('should throw if browser not launched', async () => {
      await browser.close();
      const newBrowser = new StagehandBrowser();

      await expect(newBrowser.act({ instruction: 'Click button' })).rejects.toThrow('Browser not launched');
    });
  });

  describe('extract', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should extract data successfully', async () => {
      const result = await browser.extract({
        instruction: 'Get the product title and price',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        title: 'Page Title',
        price: '$99.99',
      });
      expect(result.url).toBe('https://example.com');
    });

    it('should pass schema to extract', async () => {
      const schema = { type: 'object', properties: { title: { type: 'string' } } };

      await browser.extract({
        instruction: 'Get the title',
        schema,
      });

      expect(mockStagehand.extract).toHaveBeenCalledWith('Get the title', schema);
    });

    it('should handle extract failure gracefully', async () => {
      mockStagehand.extract.mockRejectedValueOnce(new Error('Extraction failed'));

      const result = await browser.extract({
        instruction: 'Get invalid data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Extraction failed');
    });

    it('should detect browser disconnection during extract and set status to closed', async () => {
      mockStagehand.extract.mockRejectedValueOnce(new Error('Target closed'));

      const result = await browser.extract({
        instruction: 'Get data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('browser_closed');
      expect(browser.status).toBe('closed');
    });
  });

  describe('observe', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should observe actions successfully with instruction', async () => {
      const result = await browser.observe({
        instruction: 'Find all buttons',
      });

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toEqual({
        selector: '#btn1',
        description: 'Button 1',
        method: 'click',
        arguments: undefined,
      });
      expect(mockStagehand.observe).toHaveBeenCalledWith('Find all buttons');
    });

    it('should observe without instruction', async () => {
      const result = await browser.observe({});

      expect(result.success).toBe(true);
      expect(mockStagehand.observe).toHaveBeenCalledWith();
    });

    it('should handle empty actions', async () => {
      mockStagehand.observe.mockResolvedValueOnce([]);

      const result = await browser.observe({
        instruction: 'Find buttons',
      });

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.hint).toContain('No actions found');
    });

    it('should handle observe failure gracefully', async () => {
      mockStagehand.observe.mockRejectedValueOnce(new Error('Observe failed'));

      const result = await browser.observe({
        instruction: 'Find buttons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Observe failed');
      expect(result.actions).toHaveLength(0);
    });

    it('should detect browser disconnection during observe and set status to closed', async () => {
      mockStagehand.observe.mockRejectedValueOnce(new Error('Browser has been closed'));

      const result = await browser.observe({
        instruction: 'Find buttons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('browser_closed');
      expect(browser.status).toBe('closed');
    });
  });

  describe('navigate', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should navigate to URL successfully', async () => {
      mockPage.title.mockResolvedValueOnce('New Page');
      mockPage.url.mockReturnValueOnce('https://example.com/new');

      const result = await browser.navigate({
        url: 'https://example.com/new',
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com/new');
      expect(result.title).toBe('New Page');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/new', {
        waitUntil: 'domcontentloaded',
      });
    });

    it('should pass waitUntil option', async () => {
      await browser.navigate({
        url: 'https://example.com',
        waitUntil: 'networkidle',
      });

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
      });
    });

    it('should handle navigation failure', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'));

      const result = await browser.navigate({
        url: 'https://invalid.example',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout');
    });

    it('should detect browser disconnection during navigate and set status to closed', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Target page, context or browser has been closed'));

      const result = await browser.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('browser_closed');
      expect(browser.status).toBe('closed');
    });

    it('should handle no page available', async () => {
      mockContext.pages.mockReturnValueOnce([]);

      const result = await browser.navigate({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('no_page');
    });
  });

  describe('screenshot', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should take screenshot successfully', async () => {
      const result = await browser.screenshot({});

      expect(result.success).toBe(true);
      expect(result.base64).toBe(Buffer.from('fake-png').toString('base64'));
    });

    it('should take full page screenshot', async () => {
      await browser.screenshot({ fullPage: true });

      expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true });
    });

    it('should handle screenshot failure', async () => {
      mockPage.screenshot.mockRejectedValueOnce(new Error('Screenshot failed'));

      const result = await browser.screenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshot failed');
    });

    it('should handle no page available', async () => {
      mockContext.pages.mockReturnValueOnce([]);

      const result = await browser.screenshot({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No page available');
    });
  });

  describe('getCurrentUrl', () => {
    it('should return null when not launched', () => {
      expect(browser.getCurrentUrl()).toBeNull();
    });

    it('should return current URL when launched', async () => {
      await browser.launch();
      expect(browser.getCurrentUrl()).toBe('https://example.com');
    });

    it('should return null if page.url() throws', async () => {
      await browser.launch();
      mockPage.url.mockImplementationOnce(() => {
        throw new Error('URL error');
      });
      expect(browser.getCurrentUrl()).toBeNull();
    });
  });

  describe('screencast', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('should start screencast', async () => {
      const stream = await browser.startScreencast();

      expect(stream).toBeDefined();
      expect(mockCdpSession.send).toHaveBeenCalledWith('Page.startScreencast', expect.any(Object));
    });

    it('should start screencast with options', async () => {
      const stream = await browser.startScreencast({
        format: 'png',
        quality: 80,
        maxWidth: 1280,
        maxHeight: 720,
      });

      expect(stream).toBeDefined();
      expect(mockCdpSession.send).toHaveBeenCalledWith('Page.startScreencast', {
        format: 'png',
        quality: 80,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1,
      });
    });

    it('should throw if no CDP session available', async () => {
      mockPage.getSessionForFrame.mockReturnValueOnce(null);

      await expect(browser.startScreencast()).rejects.toThrow('No CDP session available for screencast');
    });
  });

  describe('event injection', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    describe('injectMouseEvent', () => {
      it('should inject mouse click', async () => {
        await browser.injectMouseEvent({
          type: 'mousePressed',
          x: 100,
          y: 200,
          button: 'left',
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: 100,
          y: 200,
          button: 'left',
          buttons: 0,
          clickCount: 1,
          deltaX: 0,
          deltaY: 0,
          modifiers: 0,
        });
      });

      it('should inject mouse move', async () => {
        await browser.injectMouseEvent({
          type: 'mouseMoved',
          x: 150,
          y: 250,
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: 150,
          y: 250,
          button: 'none',
          buttons: 0,
          clickCount: 1,
          deltaX: 0,
          deltaY: 0,
          modifiers: 0,
        });
      });

      it('should inject mouse scroll', async () => {
        await browser.injectMouseEvent({
          type: 'mouseWheel',
          x: 100,
          y: 100,
          deltaX: 0,
          deltaY: -100,
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: 100,
          y: 100,
          button: 'none',
          buttons: 0,
          clickCount: 1,
          deltaX: 0,
          deltaY: -100,
          modifiers: 0,
        });
      });

      it('should throw if no CDP session', async () => {
        mockPage.getSessionForFrame.mockReturnValueOnce(null);

        await expect(browser.injectMouseEvent({ type: 'mousePressed', x: 0, y: 0 })).rejects.toThrow(
          'No CDP session available',
        );
      });
    });

    describe('injectKeyboardEvent', () => {
      it('should inject key press', async () => {
        await browser.injectKeyboardEvent({
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          text: undefined,
          modifiers: 0,
        });
      });

      it('should inject key with text', async () => {
        await browser.injectKeyboardEvent({
          type: 'keyDown',
          key: 'a',
          code: 'KeyA',
          text: 'a',
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'a',
          code: 'KeyA',
          text: 'a',
          modifiers: 0,
        });
      });

      it('should inject key with modifiers', async () => {
        await browser.injectKeyboardEvent({
          type: 'keyDown',
          key: 'c',
          code: 'KeyC',
          modifiers: 2, // Ctrl
        });

        expect(mockCdpSession.send).toHaveBeenCalledWith('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'c',
          code: 'KeyC',
          text: undefined,
          modifiers: 2,
        });
      });

      it('should throw if no CDP session', async () => {
        mockPage.getSessionForFrame.mockReturnValueOnce(null);

        await expect(browser.injectKeyboardEvent({ type: 'keyDown', key: 'a', code: 'KeyA' })).rejects.toThrow(
          'No CDP session available',
        );
      });
    });
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
    expect(tools[STAGEHAND_TOOLS.NAVIGATE].id).toBe('stagehand_navigate');
    expect(tools[STAGEHAND_TOOLS.SCREENSHOT].id).toBe('stagehand_screenshot');
    expect(tools[STAGEHAND_TOOLS.CLOSE].id).toBe('stagehand_close');
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
