/**
 * Tests for `createWebMcpPrepareStep` and `getPageWebMcpTools`:
 * - converting page WebMCP tools into first-class Mastra tools
 * - prepareStep integration (merge with base tools, memoization, pass-through)
 * - name sanitization and prefix collision handling
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
import { createWebMcpPrepareStep, getPageWebMcpTools } from '../webmcp-prepare-step';

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

function makeBrowser(opts: ConstructorParameters<typeof AgentBrowser>[0] = {}) {
  return new AgentBrowser({ scope: 'shared', webmcp: { enabled: true }, ...opts });
}

describe('getPageWebMcpTools', () => {
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

  it('returns an empty record when WebMCP is disabled', async () => {
    const disabled = new AgentBrowser({ scope: 'shared' });
    await disabled.launch();
    const tools = await getPageWebMcpTools(disabled);
    expect(tools).toEqual({});
    await disabled.close();
  });

  it('returns an empty record when the page exposes no tools', async () => {
    mockPage.evaluate.mockResolvedValueOnce([]);
    const tools = await getPageWebMcpTools(browser);
    expect(tools).toEqual({});
  });

  it('wraps page tools with the default page_ prefix', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await getPageWebMcpTools(browser);
    expect(Object.keys(tools).sort()).toEqual(['page_add_to_cart', 'page_get_price']);
    expect(tools.page_add_to_cart.description).toBe('Add an item to the cart');
  });

  it('respects a custom prefix', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await getPageWebMcpTools(browser, { prefix: 'shop__' });
    expect(Object.keys(tools).sort()).toEqual(['shop__add_to_cart', 'shop__get_price']);
  });

  it('allows an empty prefix', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await getPageWebMcpTools(browser, { prefix: '' });
    expect(Object.keys(tools).sort()).toEqual(['add_to_cart', 'get_price']);
  });

  it('sanitizes names that contain characters outside [A-Za-z0-9_-]', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: 'tool with spaces', source: 'w3c', description: null, inputSchema: null },
      { name: 'tool.with.dots', source: 'w3c', description: null, inputSchema: null },
    ]);
    const tools = await getPageWebMcpTools(browser);
    expect(Object.keys(tools).sort()).toEqual(['page_tool_with_dots', 'page_tool_with_spaces']);
  });

  it('skips names that collapse to empty after sanitization', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: '!!!', source: 'w3c', description: null, inputSchema: null },
      { name: 'ok', source: 'w3c', description: null, inputSchema: null },
    ]);
    const tools = await getPageWebMcpTools(browser);
    expect(Object.keys(tools)).toEqual(['page_ok']);
  });

  it('sorts tool ids so repeated calls on the same page emit the same key order', async () => {
    mockPage.evaluate.mockResolvedValueOnce([...SHOP_TOOLS].reverse());
    const first = await getPageWebMcpTools(browser);
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const second = await getPageWebMcpTools(browser);
    expect(Object.keys(first)).toEqual(Object.keys(second));
  });

  it('invokes callWebMcpTool when the wrapper is executed', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await getPageWebMcpTools(browser);
    mockPage.evaluate.mockResolvedValueOnce({ ok: true, cartSize: 1 });
    const wrapper = tools.page_add_to_cart as unknown as {
      execute: (input: unknown) => Promise<unknown>;
    };
    const result = await wrapper.execute({ itemId: 'abc' });
    expect(result).toEqual({ ok: true, cartSize: 1 });
    const callArgs = mockPage.evaluate.mock.calls[1];
    expect(callArgs?.[1]).toMatchObject({ name: 'add_to_cart', args: { itemId: 'abc' } });
  });

  it('throws when callWebMcpTool returns an error', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await getPageWebMcpTools(browser);
    mockPage.evaluate.mockRejectedValueOnce(new Error('bridge gone'));
    const wrapper = tools.page_add_to_cart as unknown as {
      execute: (input: unknown) => Promise<unknown>;
    };
    await expect(wrapper.execute({ itemId: 'abc' })).rejects.toThrow(/bridge gone/);
  });

  it('provides a fallback description when the page omits one', async () => {
    mockPage.evaluate.mockResolvedValueOnce([{ name: 'ping', source: 'w3c', description: null, inputSchema: null }]);
    const tools = await getPageWebMcpTools(browser);
    expect(tools.page_ping.description).toMatch(/WebMCP tool "ping"/);
    expect(tools.page_ping.description).toMatch(/https:\/\/shop\.test/);
  });
});

describe('createWebMcpPrepareStep', () => {
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

  it('merges page tools into the step toolset without dropping base tools', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const prepare = createWebMcpPrepareStep(browser);
    const result = await prepare({
      stepNumber: 0,
      tools: { browser_goto: {}, browser_click: {} },
    });
    expect(result).toBeDefined();
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(Object.keys(tools).sort()).toEqual(['browser_click', 'browser_goto', 'page_add_to_cart', 'page_get_price']);
  });

  it('memoizes by URL so repeat steps on the same page do not re-list', async () => {
    mockPage.evaluate.mockResolvedValue(SHOP_TOOLS);
    const prepare = createWebMcpPrepareStep(browser);
    await prepare({ stepNumber: 0, tools: {} });
    await prepare({ stepNumber: 1, tools: {} });
    await prepare({ stepNumber: 2, tools: {} });
    // One list() call across three prepareStep invocations.
    expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache when the page navigates', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const prepare = createWebMcpPrepareStep(browser);
    await prepare({ stepNumber: 0, tools: {} });
    mockPage.url.mockReturnValue('https://shop.test/checkout');
    mockPage.evaluate.mockResolvedValueOnce([{ name: 'confirm', source: 'w3c', description: null, inputSchema: null }]);
    const after = await prepare({ stepNumber: 1, tools: {} });
    expect(Object.keys((after as { tools: Record<string, unknown> }).tools)).toEqual(['page_confirm']);
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
  });

  it('returns undefined (pass-through) when no page is open', async () => {
    const other = new AgentBrowser({ scope: 'shared', webmcp: { enabled: true } });
    // Not launched: getCurrentUrl returns null.
    const prepare = createWebMcpPrepareStep(other);
    const result = await prepare({ stepNumber: 0, tools: { browser_goto: {} } });
    expect(result).toBeUndefined();
  });

  it('returns undefined when the page exposes no tools and no passthrough was given', async () => {
    mockPage.evaluate.mockResolvedValueOnce([]);
    const prepare = createWebMcpPrepareStep(browser);
    const result = await prepare({ stepNumber: 0, tools: { browser_goto: {} } });
    expect(result).toBeUndefined();
  });

  it('base tools win on collision — a page tool with the same id is dropped', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: 'click', source: 'w3c', description: 'page click', inputSchema: null },
    ]);
    const prepare = createWebMcpPrepareStep(browser, { prefix: 'browser_' });
    const baseClick = { marker: 'base-click' };
    const result = await prepare({
      stepNumber: 0,
      tools: { browser_click: baseClick },
    });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    // The page tool was prefixed as browser_click, which collides with the base
    // tool. The base tool must win.
    expect(tools.browser_click).toBe(baseClick);
  });

  it('calls the passthrough prepareStep first and merges with its result', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const passthrough = vi.fn().mockResolvedValue({
      tools: { user_tool: { marker: 'user' } },
      toolChoice: 'required',
    });
    const prepare = createWebMcpPrepareStep(browser, { passthrough });
    const result = await prepare({ stepNumber: 0, tools: { browser_goto: {} } });
    const tools = (result as { tools: Record<string, unknown> }).tools;
    expect(passthrough).toHaveBeenCalledWith({ stepNumber: 0, tools: { browser_goto: {} } });
    // Passthrough's tools (user_tool) + page tools, but NOT the original
    // args.tools (browser_goto) — the passthrough replaced them.
    expect(Object.keys(tools).sort()).toEqual(['page_add_to_cart', 'page_get_price', 'user_tool']);
    // Other fields from the passthrough result survive.
    expect((result as { toolChoice?: string }).toolChoice).toBe('required');
  });

  it('passes through the passthrough undefined-return when no page tools', async () => {
    mockPage.evaluate.mockResolvedValueOnce([]);
    const passthrough = vi.fn().mockResolvedValue(undefined);
    const prepare = createWebMcpPrepareStep(browser, { passthrough });
    const result = await prepare({ stepNumber: 0, tools: {} });
    expect(passthrough).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('threads a custom prefix end-to-end', async () => {
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const prepare = createWebMcpPrepareStep(browser, { prefix: 'shop_' });
    const result = await prepare({ stepNumber: 0, tools: {} });
    expect(Object.keys((result as { tools: Record<string, unknown> }).tools).sort()).toEqual([
      'shop_add_to_cart',
      'shop_get_price',
    ]);
  });
});

describe('AgentBrowser method surface', () => {
  it('exposes getPageWebMcpTools and createWebMcpPrepareStep on the instance', async () => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue('https://shop.test/');
    const browser = makeBrowser();
    await browser.launch();
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    const tools = await browser.getPageWebMcpTools();
    expect(Object.keys(tools)).toContain('page_add_to_cart');
    const prepare = browser.createWebMcpPrepareStep();
    expect(typeof prepare).toBe('function');
    await browser.close();
  });
});
