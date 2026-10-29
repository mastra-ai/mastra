/**
 * Tests for browser_screenshot saving into the agent's workspace
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
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

  async function screenshot(
    input: { path?: string },
    context: { workspace?: Workspace; requestContext?: RequestContext },
  ) {
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

  it('saves into a filesystem the workspace resolves per request', async () => {
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');
    const tenantDir = join(dir, 'acme');
    const resolved = new Workspace({
      filesystem: ({ requestContext }) =>
        new LocalFilesystem({ basePath: join(dir, requestContext.get('tenant') as string) }),
    });

    const result = await screenshot({ path: 'tenant.png' }, { workspace: resolved, requestContext });

    expect(result.path).toBe('tenant.png');
    expect(await readFile(join(tenantDir, 'tenant.png'))).toEqual(PNG);
  });

  it('saves into the static filesystem of a workspace from a core version without resolveFilesystem', async () => {
    // @mastra/core 1.22 (the oldest this package supports) has only the static getter.
    const olderWorkspace = { filesystem: workspace.filesystem } as unknown as Workspace;

    const result = await screenshot({ path: 'old.png' }, { workspace: olderWorkspace });

    expect(result.path).toBe('old.png');
    expect(await readFile(join(dir, 'old.png'))).toEqual(PNG);
  });

  it.each([
    ['writing is turned off', { [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { enabled: false } }, /turned off/],
    ['writes need approval', { requireApproval: true }, /needs approval/],
    [
      'a dynamic setting turns writing off',
      { [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { enabled: () => false } },
      /turned off/,
    ],
  ])("doesn't save when %s, but still returns the screenshot", async (_, config, reason) => {
    workspace.setToolsConfig(config as never);

    const result = await screenshot({ path: 'blocked.png' }, { workspace });

    expect(result.saveError).toMatch(reason);
    expect(result.base64).toBe(PNG.toString('base64'));
    await expect(readFile(join(dir, 'blocked.png'))).rejects.toThrow();
  });

  it("doesn't overwrite a file when overwriting needs approval", async () => {
    await writeFile(join(dir, 'existing.png'), 'original');
    workspace.setToolsConfig({
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval: ({ args }) => args.overwrite === true },
    });

    const result = await screenshot({ path: 'existing.png' }, { workspace });

    expect(result.saveError).toMatch(/needs approval/);
    expect(await readFile(join(dir, 'existing.png'), 'utf8')).toBe('original');
  });

  it("doesn't save into a read-only filesystem", async () => {
    const readOnly = new Workspace({ filesystem: new LocalFilesystem({ basePath: dir, readOnly: true }) });

    const result = await screenshot({ path: 'ro.png' }, { workspace: readOnly });

    expect(result.saveError).toMatch(/read-only/);
    await expect(readFile(join(dir, 'ro.png'))).rejects.toThrow();
  });

  it('still shows the model the screenshot when resolving the filesystem fails', async () => {
    const failing = new Workspace({
      filesystem: () => {
        throw new Error('no tenant');
      },
    });
    const tool = createScreenshotTool(browser);
    const result = await screenshot({ path: 'page.png' }, { workspace: failing, requestContext: new RequestContext() });

    const output = tool.toModelOutput!(result as never) as { value: Array<Record<string, unknown>> };
    expect(output.value).toEqual([
      { type: 'media', mediaType: 'image/png', data: PNG.toString('base64') },
      { type: 'text', text: "Couldn't save the screenshot: no tenant" },
    ]);
  });

  it('writes nothing without a path', async () => {
    const writeFile = vi.spyOn(workspace.filesystem!, 'writeFile');
    const result = await screenshot({}, { workspace });

    expect(result.base64).toBe(PNG.toString('base64'));
    expect(writeFile).not.toHaveBeenCalled();
  });
});
