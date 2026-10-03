/**
 * Tests for `browser.prepareStep` and `browser.attachWebMcpTools`:
 * - auto mode: all page tools are merged every step
 * - manual mode: only tools attached via `attachWebMcpTools` are merged
 * - memoization, pass-through, prefixing, collision handling, name sanitization
 */
import { MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
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

  it('drops the attached set on navigation so stale tools from the old page do not survive', async () => {
    // Attach on page A.
    mockPage.url.mockReturnValue('https://shop.test/a');
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.attachWebMcpTools();
    const beforeNav = (await browser.prepareStep({ stepNumber: 1, tools: {} })) as { tools: Record<string, unknown> };
    expect(Object.keys(beforeNav.tools).sort()).toEqual(['page_add_to_cart', 'page_get_price']);

    // Agent navigates. Next prepareStep observes the URL change and clears
    // the attached set — no page_* tools surface until the agent re-attaches.
    mockPage.url.mockReturnValue('https://shop.test/b');
    const afterNav = await browser.prepareStep({ stepNumber: 2, tools: { browser_goto: {} } });
    expect(afterNav).toBeUndefined();
    expect(browser.getAttachedWebMcpTools()).toEqual([]);
  });

  it('preserves tools attached between navigation and the next prepareStep', async () => {
    // Attach on page A, surface its tools once.
    mockPage.url.mockReturnValue('https://shop.test/a');
    mockPage.evaluate.mockResolvedValueOnce(SHOP_TOOLS);
    await browser.attachWebMcpTools();
    await browser.prepareStep({ stepNumber: 1, tools: {} });

    // Caller navigates to page B and re-attaches *before* the next
    // prepareStep. The next step must see the new tools — the URL-change
    // check compares the attach-time URL, not the previous step's URL, so
    // the fresh attachments are not wiped.
    mockPage.url.mockReturnValue('https://shop.test/b');
    const B_TOOLS = [
      { name: 'checkout', source: 'mcpb' as const, description: 'Check out', inputSchema: { type: 'object' } },
    ];
    mockPage.evaluate.mockResolvedValueOnce(B_TOOLS);
    await browser.attachWebMcpTools();

    const afterReattach = (await browser.prepareStep({ stepNumber: 2, tools: {} })) as {
      tools: Record<string, unknown>;
    };
    expect(Object.keys(afterReattach.tools)).toEqual(['page_checkout']);
    // The page-A tools must not survive onto page B.
    expect(afterReattach.tools.page_add_to_cart).toBeUndefined();
    expect(afterReattach.tools.page_get_price).toBeUndefined();
  });
});

describe('browser.prepareStep thread isolation', () => {
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

  function stepArgsForThread(threadId: string | undefined) {
    const map = new Map<string, unknown>();
    if (threadId !== undefined) map.set(MASTRA_THREAD_ID_KEY, threadId);
    const requestContext = {
      get: (key: string) => map.get(key),
      has: (key: string) => map.has(key),
    } as unknown as import('@mastra/core/request-context').RequestContext;
    return { stepNumber: 0, tools: {}, requestContext };
  }

  it('passes requestContext thread id to listWebMcpTools instead of a mutable fallback', async () => {
    const listSpy = vi
      .spyOn(browser, 'listWebMcpTools')
      .mockResolvedValue({ success: true, tools: [], origin: 'https://shop.test', hint: '' });
    const getUrlSpy = vi.spyOn(browser, 'getCurrentUrl').mockResolvedValue('https://shop.test/');
    // Mutable "current thread" state is deliberately set to something else so
    // we can prove the step args win over it.
    browser.setCurrentThread('leaked-thread');
    await browser.prepareStep(stepArgsForThread('thread-A'));
    expect(getUrlSpy).toHaveBeenLastCalledWith('thread-A');
    expect(listSpy).toHaveBeenLastCalledWith('thread-A');
  });

  it('keeps separate memo caches per thread so concurrent runs do not share tool lists', async () => {
    vi.spyOn(browser, 'getCurrentUrl').mockImplementation(async threadId =>
      threadId === 'thread-A' ? 'https://shop.test/a' : 'https://shop.test/b',
    );
    const listSpy = vi.spyOn(browser, 'listWebMcpTools').mockImplementation(async threadId => ({
      success: true,
      origin: 'https://shop.test',
      hint: '',
      tools:
        threadId === 'thread-A'
          ? [
              {
                name: 'a_only',
                source: 'mcpb' as const,
                description: null,
                inputSchema: { type: 'object', properties: {} },
              },
            ]
          : [
              {
                name: 'b_only',
                source: 'mcpb' as const,
                description: null,
                inputSchema: { type: 'object', properties: {} },
              },
            ],
    }));

    const a1 = (await browser.prepareStep(stepArgsForThread('thread-A'))) as { tools: Record<string, unknown> };
    const b1 = (await browser.prepareStep(stepArgsForThread('thread-B'))) as { tools: Record<string, unknown> };
    expect(Object.keys(a1.tools)).toEqual(['page_a_only']);
    expect(Object.keys(b1.tools)).toEqual(['page_b_only']);

    // Second step on each thread hits its own cache: still one list call per thread.
    await browser.prepareStep(stepArgsForThread('thread-A'));
    await browser.prepareStep(stepArgsForThread('thread-B'));
    const callsByThread = listSpy.mock.calls.map(c => c[0]);
    expect(callsByThread.filter(t => t === 'thread-A')).toHaveLength(1);
    expect(callsByThread.filter(t => t === 'thread-B')).toHaveLength(1);
  });

  it('manual mode reads attached tools under the step thread id, not the mutable fallback', async () => {
    const manual = new AgentBrowser({
      scope: 'shared',
      webmcp: { enabled: true, toolDiscovery: 'manual' },
    });
    await manual.launch();
    vi.spyOn(manual, 'getCurrentUrl').mockResolvedValue('https://shop.test/');
    vi.spyOn(manual, 'listWebMcpTools').mockResolvedValue({
      success: true,
      origin: 'https://shop.test',
      hint: '',
      tools: SHOP_TOOLS,
    });
    await manual.attachWebMcpTools({ names: ['get_price'] }, 'thread-A');
    manual.setCurrentThread('leaked-thread');

    const forA = (await manual.prepareStep(stepArgsForThread('thread-A'))) as { tools: Record<string, unknown> };
    const forB = await manual.prepareStep(stepArgsForThread('thread-B'));
    expect(Object.keys(forA.tools)).toEqual(['page_get_price']);
    expect(forB).toBeUndefined();
    await manual.close();
  });

  it('evicts per-thread WebMCP state on closeThreadSession so a long-lived server does not retain tool closures per thread', async () => {
    const manual = new AgentBrowser({
      scope: 'shared',
      webmcp: { enabled: true, toolDiscovery: 'manual' },
    });
    await manual.launch();
    vi.spyOn(manual, 'getCurrentUrl').mockResolvedValue('https://shop.test/');
    vi.spyOn(manual, 'listWebMcpTools').mockResolvedValue({
      success: true,
      origin: 'https://shop.test',
      hint: '',
      tools: SHOP_TOOLS,
    });
    await manual.attachWebMcpTools({ names: ['get_price'] }, 'thread-A');
    const populated = (await manual.prepareStep(stepArgsForThread('thread-A'))) as { tools: Record<string, unknown> };
    expect(Object.keys(populated.tools)).toEqual(['page_get_price']);
    expect(manual.getAttachedWebMcpTools('thread-A')).not.toEqual([]);

    await manual.closeThreadSession('thread-A');

    // After the thread's session closes, both the attached-tool record and
    // the prepare-step memo for that thread are gone. The next step for a
    // thread that comes along has to fetch fresh — no retained closures.
    expect(manual.getAttachedWebMcpTools('thread-A')).toEqual([]);
    const afterEvict = await manual.prepareStep(stepArgsForThread('thread-A'));
    expect(afterEvict).toBeUndefined();
    await manual.close();
  });
});
