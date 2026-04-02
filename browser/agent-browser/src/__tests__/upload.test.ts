/**
 * Tests for browser_upload tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLocator, mockManager } = vi.hoisted(() => {
  const mockLocator = {
    setInputFiles: vi.fn(),
  };

  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
  };

  return { mockLocator, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    getLocatorFromRef = mockManager.getLocatorFromRef;
  },
}));

import { AgentBrowser } from '../agent-browser';

describe('browser_upload', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ threadIsolation: 'none' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('uploads a single file', async () => {
    const result = await browser.upload({ ref: '@file-input', files: ['/path/to/file.pdf'] });

    expect(mockLocator.setInputFiles).toHaveBeenCalledWith(['/path/to/file.pdf'], expect.any(Object));
    expect(result.success).toBe(true);
  });

  it('uploads multiple files', async () => {
    const files = ['/path/to/file1.pdf', '/path/to/file2.png'];
    const result = await browser.upload({ ref: '@file-input', files });

    expect(mockLocator.setInputFiles).toHaveBeenCalledWith(files, expect.any(Object));
    expect(result.success).toBe(true);
  });

  it('returns error for invalid ref', async () => {
    mockManager.getLocatorFromRef.mockReturnValueOnce(null);

    const result = await browser.upload({ ref: '@invalid', files: ['/path/to/file.pdf'] });

    expect(result.success).toBe(false);
  });

  it('returns error when setInputFiles fails', async () => {
    mockLocator.setInputFiles.mockRejectedValueOnce(new Error('Not a file input'));

    const result = await browser.upload({ ref: '@button', files: ['/path/to/file.pdf'] });

    expect(result.success).toBe(false);
  });

  it('handles files with spaces in names', async () => {
    const result = await browser.upload({ ref: '@file-input', files: ['/path/to/my file.pdf'] });

    expect(mockLocator.setInputFiles).toHaveBeenCalledWith(['/path/to/my file.pdf'], expect.any(Object));
    expect(result.success).toBe(true);
  });
});
