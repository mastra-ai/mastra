/**
 * Tests for `browser.prepareStep` and `browser.attachWebMcpTools`:
 * - auto mode: all page tools are merged every step
 * - manual mode: only tools attached via `attachWebMcpTools` are merged
 * - memoization, pass-through, prefixing, collision handling, name sanitization
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockManager } = vi.hoisted(() => {
  const mockContext = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
  };
  const mockPage = {
    url: vi.fn().mockReturnValue('https://shop.test/'),
    evaluate: vi.fn(),
  };
  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getContext: vi.fn().mockReturnValue(mockContext),
  };
  return { mockPage, mockContext, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    getContext = mockManager.getContext;
  },
}));

import { AgentBrowser } from '../agent-browser';

const SHOP_TOOLS = [
  {
    name: 'get_price',
    source: 'mcpb' as const,
    description: 'Get the current cart price',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_to_cart',
    source: 'mcpb' as const,
    description: 'Add an item to the cart',
    inputSchema: {
      type: 'object',
      properties: { itemId: { type: 'string' } },
      required: ['itemId'],
    },
  },
];

type MakeOpts = ConstructorParameters<typeof AgentBrowser>[0];

function makeBrowser(opts: MakeOpts = {}) {
  return new AgentBrowser({
    scope: 'shared',
    webmcp: { enabled: true },
    ...opts,
  });
}

describe('browser.prepareStep (auto mode)', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue('https://shop.test/');
    browser = makeBrowser();
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('is a no-op when WebMCP is disabled', async () => {
    const other = new AgentBrowser({ scope: 'shared' });
    await other.launch();
    const result = await other.prepareStep({ stepNumber: 0, tools: { browser_goto: {} } });
    expect(result).toBeUndefined();
    await other.close();
  });

  it('merges every page tool into the step toolset', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const result = await browser.prepareStep({ stepNumber: 0, tools: { browser_goto: {}, browser_click: {} } });
    expect(result).toBeDefined();
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools).sort()).toEqual(['browser_click', 'browser_goto', 'page_add_to_cart', 'page_get_price']);
  });

  it('memoizes by URL — repeat steps on the same page do not re-list', async () => {
    mockPage.evaluate.mockResolvedValue(SHOP_TOOLS);
    await browser.prepareStep({ stepNumber: 0, tools: {} });
    await browser.prepareStep({ stepNumber: 1, tools: {} });
    await browser.prepareStep({ stepNumber: 2, tools: {} });
    expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache when the page navigates', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.prepareStep({ stepNumber: 0, tools: {} });
    mockPage.url.mockReturnValue('https://shop.test/checkout');
    mockPage.evaluate.mockResolvedValueOnce([{ name: 'confirm', source: 'w3c', description: null, inputSchema: null }]);
    const after = await browser.prepareStep({ stepNumber: 1, tools: {} });
    expect(Object.keys((after as { tools: Record<string, unknown> }).tools)).toEqual(['page_confirm']);
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
  });

  it('returns undefined when the page exposes no tools', async () => {
    mockPage.evaluate.mockResolvedValueOnce([]);
    const result = await browser.prepareStep({ stepNumber: 0, tools: { browser_goto: {} } });
    expect(result).toBeUndefined();
  });

  it('base tools win on collision — a page tool with the same id is dropped', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: 'click', source: 'w3c', description: 'page click', inputSchema: null },
    ]);
    const custom = new AgentBrowser({
      scope: 'shared',
      webmcp: { enabled: true, toolPrefix: 'browser_' },
    });
    await custom.launch();
    const baseClick = { marker: 'base-click' };
    const result = await custom.prepareStep({ stepNumber: 0, tools: { browser_click: baseClick } });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(tools.browser_click).toBe(baseClick);
    await custom.close();
  });

  it('threads a custom toolPrefix end-to-end', async () => {
    const custom = new AgentBrowser({
      scope: 'shared',
      webmcp: { enabled: true, toolPrefix: 'shop_' },
    });
    await custom.launch();
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const result = await custom.prepareStep({ stepNumber: 0, tools: {} });
    expect(Object.keys((result as { tools: Record<string, unknown> }).tools).sort()).toEqual([
      'shop_add_to_cart',
      'shop_get_price',
    ]);
    await custom.close();
  });

  it('sanitizes raw tool names into valid ids', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: 'tool with spaces', source: 'w3c', description: null, inputSchema: null },
      { name: 'tool.with.dots', source: 'w3c', description: null, inputSchema: null },
    ]);
    const result = await browser.prepareStep({ stepNumber: 0, tools: {} });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools).sort()).toEqual(['page_tool_with_dots', 'page_tool_with_spaces']);
  });
});

describe('browser.prepareStep (manual mode)', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue('https://shop.test/');
    browser = makeBrowser({ webmcp: { enabled: true, toolDiscovery: 'manual' } });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('does not auto-merge page tools — the toolset is unchanged before the agent calls discover', async () => {
    const result = await browser.prepareStep({ stepNumber: 0, tools: { browser_goto: {} } });
    expect(result).toBeUndefined();
    // No listWebMcpTools evaluation happened.
    expect(mockPage.evaluate).not.toHaveBeenCalled();
  });

  it('merges tools after attachWebMcpTools is called', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const attached = await browser.attachWebMcpTools();
    expect(attached.success).toBe(true);
    if (attached.success) {
      expect(attached.attached.map(t => t.id).sort()).toEqual(['page_add_to_cart', 'page_get_price']);
    }
    const result = await browser.prepareStep({ stepNumber: 1, tools: { browser_goto: {} } });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools).sort()).toEqual(['browser_goto', 'page_add_to_cart', 'page_get_price']);
  });

  it('attaches only the names requested in `names`', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const attached = await browser.attachWebMcpTools({ names: ['get_price'] });
    expect(attached.success).toBe(true);
    if (attached.success) expect(attached.attached).toHaveLength(1);
    const result = await browser.prepareStep({ stepNumber: 1, tools: {} });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools)).toEqual(['page_get_price']);
  });

  it('reports names in `notFound` when they are not on the page', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const attached = await browser.attachWebMcpTools({ names: ['get_price', 'does_not_exist'] });
    expect(attached.success).toBe(true);
    if (attached.success) {
      expect(attached.notFound).toEqual(['does_not_exist']);
      expect(attached.attached.map(t => t.rawName)).toEqual(['get_price']);
    }
  });

  it('accumulates attachments across multiple discover calls', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.attachWebMcpTools({ names: ['get_price'] });
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.attachWebMcpTools({ names: ['add_to_cart'] });
    const result = await browser.prepareStep({ stepNumber: 2, tools: {} });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools).sort()).toEqual(['page_add_to_cart', 'page_get_price']);
  });

  it('returns an error from attachWebMcpTools when WebMCP is disabled', async () => {
    const other = new AgentBrowser({ scope: 'shared' });
    await other.launch();
    const result = await other.attachWebMcpTools();
    expect(result.success).toBe(false);
    await other.close();
  });

  it('invokes the wrapped tool via callWebMcpTool when executed', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.attachWebMcpTools();
    const result = (await browser.prepareStep({ stepNumber: 1, tools: {} })) as { tools: Record<string, unknown> };
    const wrapper = result.tools.page_add_to_cart as unknown as { execute: (input: unknown) => Promise<unknown> };
    mockPage.evaluate.mockResolvedValueOnce({ ok: true });
    const out = await wrapper.execute({ itemId: 'abc' });
    expect(out).toEqual({ ok: true });
    const callArgs = mockPage.evaluate.mock.calls.at(-1);
    expect(callArgs?.[1]).toMatchObject({ name: 'add_to_cart', args: { itemId: 'abc' } });
  });
});
