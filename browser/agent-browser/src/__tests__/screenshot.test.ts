/**
 * Tests for browser_screenshot saving into the agent's workspace
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const { mockPage, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example'),
    screenshot: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
  };

  return { mockPage, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
  },
}));

import { AgentBrowser } from '../agent-browser';
import { createScreenshotTool } from '../tools/screenshot';

type ScreenshotResult = { base64?: string; path?: string; saveError?: string };

describe('browser_screenshot', () => {
  let browser: AgentBrowser;
  let dir: string;
  let workspace: Workspace;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPage.screenshot.mockResolvedValue(PNG);
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
    dir = await mkdtemp(join(tmpdir(), 'screenshot-'));
    workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: dir }) });
  });

  afterEach(async () => {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  });

  async function screenshot(input: { path?: string }, context: { workspace?: Workspace }) {
    const tool = createScreenshotTool(browser);
    return (await tool.execute!(input, context as never)) as ScreenshotResult;
  }

  it('saves the PNG into the workspace when given a path', async () => {
    const result = await screenshot({ path: 'shots/page.png' }, { workspace });

    expect(result.path).toBe('shots/page.png');
    expect(result.base64).toBe(PNG.toString('base64'));
    expect(await readFile(join(dir, 'shots/page.png'))).toEqual(PNG);
  });

  it('tells the model where the file went', async () => {
    const tool = createScreenshotTool(browser);
    const result = await screenshot({ path: 'page.png' }, { workspace });

    const output = tool.toModelOutput!(result as never) as { value: Array<{ type: string; text?: string }> };
    expect(output.value).toContainEqual({ type: 'text', text: 'Saved to page.png' });
  });

  it('still shows the model the screenshot when there is no workspace to save into', async () => {
    const tool = createScreenshotTool(browser);
    const result = await screenshot({ path: 'page.png' }, {});

    expect(result.path).toBeUndefined();
    const output = tool.toModelOutput!(result as never) as { value: Array<Record<string, unknown>> };
    expect(output.value).toEqual([
      { type: 'media', mediaType: 'image/png', data: PNG.toString('base64') },
      {
        type: 'text',
        text: "Couldn't save the screenshot: There is no workspace filesystem to save the screenshot into.",
      },
    ]);
  });

  it('still shows the model the screenshot when saving it fails', async () => {
    vi.spyOn(workspace.filesystem!, 'writeFile').mockRejectedValueOnce(new Error('disk full'));
    const tool = createScreenshotTool(browser);
    const result = await screenshot({ path: 'page.png' }, { workspace });

    const output = tool.toModelOutput!(result as never) as { value: Array<Record<string, unknown>> };
    expect(output.value).toEqual([
      { type: 'media', mediaType: 'image/png', data: PNG.toString('base64') },
      { type: 'text', text: "Couldn't save the screenshot: disk full" },
    ]);
  });

  it('writes nothing without a path', async () => {
    const writeFile = vi.spyOn(workspace.filesystem!, 'writeFile');
    const result = await screenshot({}, { workspace });

    expect(result.base64).toBe(PNG.toString('base64'));
    expect(writeFile).not.toHaveBeenCalled();
  });
});
