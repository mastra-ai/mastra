/**
 * Tests for WebMCP host integration in AgentBrowser:
 * tool registration gating, init-script injection, origin allowlist,
 * and the list/call paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockContext, mockManager } = vi.hoisted(() => {
  const mockContext = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
  };
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com/'),
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
import { BROWSER_TOOLS } from '../tools/constants';

describe('WebMCP: tool registration gating', () => {
  it('exposes browser_webmcp by default (no webmcp config)', () => {
    const browser = new AgentBrowser({ scope: 'shared' });
    expect(Object.keys(browser.getTools())).toContain(BROWSER_TOOLS.WEBMCP);
  });

  it('exposes browser_webmcp when webmcp is an empty object', () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: {} });
    expect(Object.keys(browser.getTools())).toContain(BROWSER_TOOLS.WEBMCP);
  });

  it('hides browser_webmcp when webmcp.enabled is false', () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: { enabled: false } });
    expect(Object.keys(browser.getTools())).not.toContain(BROWSER_TOOLS.WEBMCP);
  });

  it('respects excludeTools for browser_webmcp', () => {
    const browser = new AgentBrowser({
      scope: 'shared',
      excludeTools: [BROWSER_TOOLS.WEBMCP],
    });
    expect(Object.keys(browser.getTools())).not.toContain(BROWSER_TOOLS.WEBMCP);
  });
});

describe('WebMCP: bridge installation', () => {
  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('installs the init script by default', async () => {
    const browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
    expect(mockContext.addInitScript).toHaveBeenCalledTimes(1);
    const callArgs = mockContext.addInitScript.mock.calls[0]?.[0];
    expect(callArgs).toHaveProperty('content');
    expect(typeof callArgs.content).toBe('string');
    expect(callArgs.content).toContain('__mastraWebMcp');
    await browser.close();
  });

  it('does not install the init script when webmcp.enabled is false', async () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: { enabled: false } });
    await browser.launch();
    expect(mockContext.addInitScript).not.toHaveBeenCalled();
    await browser.close();
  });

  it('defaults the injected protocols to all supported protocols', async () => {
    const browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
    const content = mockContext.addInitScript.mock.calls[0]?.[0]?.content as string;
    expect(content).toMatch(/PROTOCOLS = \["mcpb","w3c"\]/);
    await browser.close();
  });

  it('treats an empty protocols array like unset (all protocols)', async () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: { protocols: [] } });
    await browser.launch();
    const content = mockContext.addInitScript.mock.calls[0]?.[0]?.content as string;
    expect(content).toMatch(/PROTOCOLS = \["mcpb","w3c"\]/);
    await browser.close();
  });

  it('passes protocols=[w3c] through to the bridge', async () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: { protocols: ['w3c'] } });
    await browser.launch();
    const content = mockContext.addInitScript.mock.calls[0]?.[0]?.content as string;
    expect(content).toMatch(/PROTOCOLS = \["w3c"\]/);
    await browser.close();
  });

  it('passes protocols=[mcpb] through to the bridge', async () => {
    const browser = new AgentBrowser({ scope: 'shared', webmcp: { protocols: ['mcpb'] } });
    await browser.launch();
    const content = mockContext.addInitScript.mock.calls[0]?.[0]?.content as string;
    expect(content).toMatch(/PROTOCOLS = \["mcpb"\]/);
    await browser.close();
  });
});

describe('WebMCP: list', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue('https://example.com/');
    browser = new AgentBrowser({ scope: 'shared', webmcp: {} });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('returns the tools reported by the in-page bridge', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { name: 'add', source: 'w3c', description: 'Add two numbers', inputSchema: null },
    ]);
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tools).toEqual([{ name: 'add', source: 'w3c', description: 'Add two numbers', inputSchema: null }]);
      expect(result.origin).toBe('https://example.com');
      expect(result.hint).toMatch(/action="call"/);
    }
  });

  it('returns an empty list with a navigation hint when the page has no tools', async () => {
    mockPage.evaluate.mockResolvedValueOnce([]);
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tools).toEqual([]);
      expect(result.hint).toMatch(/No WebMCP tools/);
    }
  });

  it('returns an error when webmcp.enabled is false', async () => {
    const other = new AgentBrowser({ scope: 'shared', webmcp: { enabled: false } });
    await other.launch();
    const result = await other.listWebMcpTools();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/not enabled/);
    }
    await other.close();
  });
});

describe('WebMCP: call', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPage.url.mockReturnValue('https://example.com/');
    browser = new AgentBrowser({ scope: 'shared', webmcp: {} });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('forwards the tool name and args to the in-page bridge', async () => {
    mockPage.evaluate.mockResolvedValueOnce({ ok: true });
    const result = await browser.callWebMcpTool({ toolName: 'checkout', args: { items: 2 } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toEqual({ ok: true });
    const callArgs = mockPage.evaluate.mock.calls[0];
    expect(callArgs?.[1]).toEqual({ name: 'checkout', args: { items: 2 } });
  });

  it('surfaces bridge errors from page.evaluate rejections', async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error('WebMCP tool "ghost" is not registered on this page'));
    const result = await browser.callWebMcpTool({ toolName: 'ghost' });
    expect(result.success).toBe(false);
  });
});

describe('WebMCP: origin allowlist', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows any origin when allowedOrigins is unset', async () => {
    mockPage.url.mockReturnValue('https://any-site.test/path');
    mockPage.evaluate.mockResolvedValue([]);
    const browser = new AgentBrowser({ scope: 'shared', webmcp: {} });
    await browser.launch();
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(true);
    await browser.close();
  });

  it('allows pages whose origin is in the allowlist', async () => {
    mockPage.url.mockReturnValue('https://example.com/some/path?x=1');
    mockPage.evaluate.mockResolvedValue([]);
    const browser = new AgentBrowser({
      scope: 'shared',
      webmcp: { allowedOrigins: ['https://example.com'] },
    });
    await browser.launch();
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(true);
    await browser.close();
  });

  it('rejects pages whose origin is not in the allowlist', async () => {
    mockPage.url.mockReturnValue('https://untrusted.example/path');
    const browser = new AgentBrowser({
      scope: 'shared',
      webmcp: { allowedOrigins: ['https://example.com'] },
    });
    await browser.launch();
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/not allowed/);
    await browser.close();
  });

  it('rejects about:blank when an allowlist is configured', async () => {
    mockPage.url.mockReturnValue('about:blank');
    const browser = new AgentBrowser({
      scope: 'shared',
      webmcp: { allowedOrigins: ['https://example.com'] },
    });
    await browser.launch();
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(false);
    await browser.close();
  });

  it('matches file:// pages against a file:// allowlist entry', async () => {
    mockPage.url.mockReturnValue('file:///tmp/fixture.html');
    mockPage.evaluate.mockResolvedValue([]);
    const browser = new AgentBrowser({
      scope: 'shared',
      webmcp: { allowedOrigins: ['file://'] },
    });
    await browser.launch();
    const result = await browser.listWebMcpTools();
    expect(result.success).toBe(true);
    await browser.close();
  });

  it('also enforces the allowlist on call', async () => {
    mockPage.url.mockReturnValue('https://untrusted.example/');
    const browser = new AgentBrowser({
      scope: 'shared',
      webmcp: { allowedOrigins: ['https://example.com'] },
    });
    await browser.launch();
    const result = await browser.callWebMcpTool({ toolName: 'foo' });
    expect(result.success).toBe(false);
    expect(mockPage.evaluate).not.toHaveBeenCalled();
    await browser.close();
  });
});
