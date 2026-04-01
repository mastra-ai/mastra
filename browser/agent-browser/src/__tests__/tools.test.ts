/**
 * Tests for AgentBrowser tool implementations:
 * - upload: File upload to input elements
 * - dialog: Browser dialog handling (alert, confirm, prompt)
 * - drag: Drag and drop operations
 * - evaluate: JavaScript evaluation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mocks using vi.hoisted so they're available before vi.mock
const { mockPage, mockLocator, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example'),
    goto: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    close: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    evaluate: vi.fn(),
    viewportSize: () => ({ width: 1280, height: 720 }),
    content: vi.fn().mockResolvedValue('<html></html>'),
    waitForTimeout: vi.fn(),
    keyboard: {
      press: vi.fn(),
      type: vi.fn(),
      down: vi.fn(),
      up: vi.fn(),
    },
    mouse: {
      click: vi.fn(),
      dblclick: vi.fn(),
      move: vi.fn(),
    },
    locator: vi.fn().mockReturnValue({
      click: vi.fn(),
      fill: vi.fn(),
      selectOption: vi.fn(),
      check: vi.fn(),
      uncheck: vi.fn(),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue('text'),
      inputValue: vi.fn().mockResolvedValue('value'),
    }),
    frames: vi.fn().mockReturnValue([]),
    context: vi.fn().mockReturnValue({
      pages: vi.fn().mockReturnValue([]),
      newPage: vi.fn(),
      cookies: vi.fn().mockResolvedValue([]),
      addCookies: vi.fn(),
      clearCookies: vi.fn(),
      storageState: vi.fn().mockResolvedValue({}),
      newCDPSession: vi.fn().mockResolvedValue({
        send: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }),
    }),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  };

  const mockLocator = {
    click: vi.fn(),
    dblclick: vi.fn(),
    fill: vi.fn(),
    focus: vi.fn(),
    hover: vi.fn(),
    press: vi.fn(),
    selectOption: vi.fn().mockResolvedValue(['value1']),
    check: vi.fn(),
    uncheck: vi.fn(),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    textContent: vi.fn().mockResolvedValue('text'),
    inputValue: vi.fn().mockResolvedValue('value'),
    scrollIntoViewIfNeeded: vi.fn(),
    setInputFiles: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    dragTo: vi.fn(),
    waitFor: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
    getRefMap: vi.fn().mockResolvedValue(
      new Map([
        ['@e1', mockLocator],
        ['@e2', mockLocator],
      ]),
    ),
    getCDPSession: vi.fn().mockResolvedValue({
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }),
    getSnapshot: vi.fn().mockResolvedValue({ snapshot: '- @e1 button "Click"', tree: '- @e1 button "Click"' }),
    startScreencast: vi.fn().mockResolvedValue(undefined),
    stopScreencast: vi.fn().mockResolvedValue(undefined),
    injectMouseEvent: vi.fn().mockResolvedValue(undefined),
    injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
    newTab: vi.fn().mockResolvedValue({ index: 0, total: 1 }),
    newWindow: vi.fn().mockResolvedValue({ index: 0, total: 1 }),
    switchTo: vi.fn().mockResolvedValue({ index: 0, url: 'https://example.com', title: 'Example' }),
    closeTab: vi.fn().mockResolvedValue({ closed: 1, remaining: 0 }),
    listTabs: vi.fn().mockResolvedValue([{ index: 0, url: 'https://example.com', title: 'Example', active: true }]),
    getContext: vi.fn().mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      pages: vi.fn().mockReturnValue([mockPage]),
    }),
    getPages: vi.fn().mockReturnValue([mockPage]),
  };

  return { mockPage, mockLocator, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    getLocatorFromRef = mockManager.getLocatorFromRef;
    getRefMap = mockManager.getRefMap;
    getCDPSession = mockManager.getCDPSession;
    getSnapshot = mockManager.getSnapshot;
    startScreencast = mockManager.startScreencast;
    stopScreencast = mockManager.stopScreencast;
    injectMouseEvent = mockManager.injectMouseEvent;
    injectKeyboardEvent = mockManager.injectKeyboardEvent;
    newTab = mockManager.newTab;
    newWindow = mockManager.newWindow;
    switchTo = mockManager.switchTo;
    closeTab = mockManager.closeTab;
    listTabs = mockManager.listTabs;
    getContext = mockManager.getContext;
    getPages = mockManager.getPages;
  },
}));

// Import AFTER vi.mock
import { AgentBrowser } from '../agent-browser';

describe('AgentBrowser Tools', () => {
  let browser: AgentBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ threadIsolation: 'none' });
  });

  afterEach(async () => {
    await browser.close();
  });

  // ===========================================================================
  // Upload Tool
  // ===========================================================================
  describe('upload', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('uploads a single file', async () => {
      const result = await browser.upload({ ref: '@e1', files: ['/path/to/file.txt'] });

      expect(result.success).toBe(true);
      expect(mockLocator.setInputFiles).toHaveBeenCalledWith(['/path/to/file.txt'], expect.any(Object));
    });

    it('uploads multiple files', async () => {
      const files = ['/path/to/file1.txt', '/path/to/file2.pdf', '/path/to/image.png'];
      const result = await browser.upload({ ref: '@e1', files });

      expect(result.success).toBe(true);
      expect(mockLocator.setInputFiles).toHaveBeenCalledWith(files, expect.any(Object));
    });

    it('returns error for invalid ref', async () => {
      // getLocatorFromRef returns null for invalid refs
      mockManager.getLocatorFromRef.mockReturnValueOnce(null);

      const result = await browser.upload({ ref: '@invalid', files: ['/path/to/file.txt'] });

      expect(result.success).toBe(false);
      expect((result as any).code).toBe('stale_ref');
    });

    it('handles upload failure', async () => {
      mockLocator.setInputFiles.mockRejectedValueOnce(new Error('Upload failed'));

      const result = await browser.upload({ ref: '@e1', files: ['/path/to/file.txt'] });

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Dialog Tool
  // ===========================================================================
  describe('dialog', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('accepts an alert dialog', async () => {
      // Mock dialog event - invoke handler immediately after it's registered
      mockPage.once.mockImplementation((event: string, handler: any) => {
        if (event === 'dialog') {
          // Use setImmediate to invoke after the promise is set up
          setImmediate(() => {
            handler({
              type: () => 'alert',
              message: () => 'Alert message',
              accept: vi.fn().mockResolvedValue(undefined),
              dismiss: vi.fn().mockResolvedValue(undefined),
            });
          });
        }
      });

      const result = await browser.dialog({ action: 'accept' });

      expect(result.success).toBe(true);
      expect((result as any).action).toBe('accept');
    });

    it('dismisses a confirm dialog', async () => {
      const mockDismiss = vi.fn().mockResolvedValue(undefined);

      mockPage.once.mockImplementation((event: string, handler: any) => {
        if (event === 'dialog') {
          setImmediate(() => {
            handler({
              type: () => 'confirm',
              message: () => 'Are you sure?',
              accept: vi.fn().mockResolvedValue(undefined),
              dismiss: mockDismiss,
            });
          });
        }
      });

      const result = await browser.dialog({ action: 'dismiss' });

      expect(result.success).toBe(true);
      expect((result as any).action).toBe('dismiss');
      expect(mockDismiss).toHaveBeenCalled();
    });

    it('accepts a prompt dialog with text', async () => {
      const mockAccept = vi.fn().mockResolvedValue(undefined);

      mockPage.once.mockImplementation((event: string, handler: any) => {
        if (event === 'dialog') {
          setImmediate(() => {
            handler({
              type: () => 'prompt',
              message: () => 'Enter your name:',
              accept: mockAccept,
              dismiss: vi.fn().mockResolvedValue(undefined),
            });
          });
        }
      });

      const result = await browser.dialog({ action: 'accept', text: 'User input' });

      expect(result.success).toBe(true);
      expect(mockAccept).toHaveBeenCalledWith('User input');
    });

    it('times out if no dialog appears', async () => {
      // Don't trigger any dialog - should timeout
      mockPage.once.mockImplementation(() => {
        // Handler is registered but never invoked
      });

      // Create browser with short timeout for this test
      const shortTimeoutBrowser = new AgentBrowser({ threadIsolation: 'none', timeout: 100 });
      await shortTimeoutBrowser.ensureReady();

      // The current implementation throws on timeout rather than returning an error
      // This tests the actual behavior - ideally it would return a proper error object
      await expect(shortTimeoutBrowser.dialog({ action: 'accept' })).rejects.toThrow('Dialog handler timed out');

      await shortTimeoutBrowser.close();
    });
  });

  // ===========================================================================
  // Drag Tool
  // ===========================================================================
  describe('drag', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('drags element to target element', async () => {
      const result = await browser.drag({ sourceRef: '@e1', targetRef: '@e2' });

      expect(result.success).toBe(true);
      expect(mockLocator.dragTo).toHaveBeenCalled();
    });

    it('returns error for invalid source ref', async () => {
      // getLocatorFromRef returns null for invalid refs
      mockManager.getLocatorFromRef.mockReturnValueOnce(null);

      const result = await browser.drag({ sourceRef: '@invalid', targetRef: '@e2' });

      expect(result.success).toBe(false);
      expect((result as any).code).toBe('stale_ref');
    });

    it('returns error for invalid target ref', async () => {
      // First call for sourceRef returns valid locator, second call for targetRef returns null
      mockManager.getLocatorFromRef.mockReturnValueOnce(mockLocator).mockReturnValueOnce(null);

      const result = await browser.drag({ sourceRef: '@e1', targetRef: '@invalid' });

      expect(result.success).toBe(false);
      expect((result as any).code).toBe('stale_ref');
    });

    it('handles drag failure', async () => {
      mockLocator.dragTo.mockRejectedValueOnce(new Error('Drag failed'));

      const result = await browser.drag({ sourceRef: '@e1', targetRef: '@e2' });

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Evaluate Tool
  // ===========================================================================
  describe('evaluate', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('evaluates simple JavaScript expression', async () => {
      mockPage.evaluate.mockResolvedValueOnce('Example Title');

      const result = await browser.evaluate({ script: 'document.title' });

      expect(result.success).toBe(true);
      expect((result as any).result).toBe('Example Title');
    });

    it('evaluates JavaScript returning object', async () => {
      const returnValue = { width: 1920, height: 1080 };
      mockPage.evaluate.mockResolvedValueOnce(returnValue);

      const result = await browser.evaluate({ script: '({ width: window.innerWidth, height: window.innerHeight })' });

      expect(result.success).toBe(true);
      expect((result as any).result).toEqual(returnValue);
    });

    it('evaluates JavaScript returning array', async () => {
      const returnValue = ['item1', 'item2', 'item3'];
      mockPage.evaluate.mockResolvedValueOnce(returnValue);

      const result = await browser.evaluate({
        script: 'Array.from(document.querySelectorAll("li")).map(el => el.textContent)',
      });

      expect(result.success).toBe(true);
      expect((result as any).result).toEqual(returnValue);
    });

    it('evaluates JavaScript returning null', async () => {
      mockPage.evaluate.mockResolvedValueOnce(null);

      const result = await browser.evaluate({ script: 'document.querySelector(".nonexistent")' });

      expect(result.success).toBe(true);
      expect((result as any).result).toBeNull();
    });

    it('evaluates JavaScript returning undefined', async () => {
      mockPage.evaluate.mockResolvedValueOnce(undefined);

      const result = await browser.evaluate({ script: 'console.log("hello")' });

      expect(result.success).toBe(true);
      expect((result as any).result).toBeUndefined();
    });

    it('handles JavaScript evaluation error', async () => {
      mockPage.evaluate.mockRejectedValueOnce(new Error('ReferenceError: foo is not defined'));

      const result = await browser.evaluate({ script: 'foo.bar()' });

      expect(result.success).toBe(false);
    });

    it('handles syntax error in script', async () => {
      mockPage.evaluate.mockRejectedValueOnce(new SyntaxError('Unexpected token'));

      const result = await browser.evaluate({ script: 'function(' });

      expect(result.success).toBe(false);
    });
  });
});
