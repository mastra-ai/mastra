/**
 * WebMCP integration tests with a real browser.
 *
 * Launches headless Chromium and serves a real page over HTTP that exposes
 * tools through BOTH supported protocols:
 *
 * - W3C: `navigator.modelContext.registerTool` (provided by the bridge shim)
 * - MCP-B: an in-page MCP server speaking the `@mcp-b/transports` Tab
 *   transport wire format (postMessage envelopes + JSON-RPC payloads),
 *   exactly what pages get from `McpServer` + `TabServerTransport`.
 *
 * Also drives the full @mastra/core Agent tool-execution loop with a
 * scripted model, covering both discovery modes:
 *
 * - auto: `browser.prepareStep` merges every page tool each step so the agent
 *   can go browser_goto → page_add_to_cart directly.
 * - manual: `browser_webmcp_discover` attaches tools on demand, and
 *   `browser.prepareStep` surfaces the attached ones on the next step.
 *
 * Skip when Playwright/Chromium is not available (CI without browsers).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Agent } from '@mastra/core/agent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from '../agent-browser';

type PageLike = {
  evaluate: (script: string) => Promise<unknown>;
  title: () => Promise<string>;
  goto: (url: string) => Promise<unknown>;
};

/** getPage is private on AgentBrowser; tests reach in to verify page state. */
function getPage(browser: AgentBrowser): Promise<PageLike> {
  return (browser as unknown as { getPage: (threadId?: string) => Promise<PageLike> }).getPage();
}

// Check if we can actually launch a browser with AgentBrowser.
// Only skip for known environment/setup failures, not regressions.
let canLaunchBrowser = true;
const probeBrowser = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  await probeBrowser.ensureReady();
  await probeBrowser.close();
} catch (error) {
  try {
    await probeBrowser.close();
  } catch {
    // Ignore cleanup errors
  }
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isEnvironmentError =
    errorMessage.includes("Executable doesn't exist") ||
    errorMessage.includes('browserType.launch') ||
    errorMessage.includes('Cannot find module') ||
    errorMessage.includes('ENOENT');
  if (isEnvironmentError) {
    canLaunchBrowser = false;
  } else {
    throw error;
  }
}

const PAGE = /* html */ `<!doctype html>
<html>
  <head><title>WebMCP Shop</title></head>
  <body>
    <h1>WebMCP Shop</h1>
    <script>
      var cart = [];

      // W3C surface: navigator.modelContext (bridge shim or native).
      navigator.modelContext.registerTool({
        name: 'get_cart',
        description: 'Read the current cart contents',
        inputSchema: { type: 'object', properties: {} },
        execute: function () { return { items: cart }; },
      });

      // MCP-B surface: an in-page MCP server over the Tab transport wire
      // format (what McpServer + TabServerTransport produce).
      function serverPost(payload) {
        window.postMessage({ channel: 'mcp-default', type: 'mcp', direction: 'server-to-client', payload: payload }, '*');
      }
      window.addEventListener('message', function (ev) {
        var d = ev.data;
        if (!d || d.channel !== 'mcp-default' || d.type !== 'mcp' || d.direction !== 'client-to-server') return;
        var p = d.payload;
        if (p === 'mcp-check-ready') { serverPost('mcp-server-ready'); return; }
        if (!p || typeof p !== 'object') return;
        if (p.method === 'initialize') {
          serverPost({ jsonrpc: '2.0', id: p.id, result: {
            protocolVersion: '2025-06-18', capabilities: { tools: {} },
            serverInfo: { name: 'webmcp-shop', version: '1.0.0' },
          } });
          return;
        }
        if (p.method === 'notifications/initialized') return;
        if (p.method === 'tools/list') {
          serverPost({ jsonrpc: '2.0', id: p.id, result: { tools: [
            { name: 'get_price', description: 'Get the price (in cents) for a SKU',
              inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] } },
            { name: 'add_to_cart', description: 'Add a SKU to the cart',
              inputSchema: { type: 'object',
                properties: { sku: { type: 'string' }, qty: { type: 'number' } }, required: ['sku', 'qty'] } },
          ] } });
          return;
        }
        if (p.method === 'tools/call') {
          var name = p.params && p.params.name;
          var args = (p.params && p.params.arguments) || {};
          if (name === 'get_price') {
            serverPost({ jsonrpc: '2.0', id: p.id, result: {
              content: [{ type: 'text', text: JSON.stringify({ sku: args.sku, priceCents: 129900 }) }],
            } });
          } else if (name === 'add_to_cart') {
            cart.push({ sku: args.sku, qty: args.qty });
            document.title = 'WebMCP Shop (cart: ' + cart.length + ')';
            serverPost({ jsonrpc: '2.0', id: p.id, result: {
              structuredContent: { ok: true, cartSize: cart.length },
              content: [{ type: 'text', text: 'added' }],
            } });
          } else {
            serverPost({ jsonrpc: '2.0', id: p.id, result: {
              isError: true, content: [{ type: 'text', text: 'unknown tool: ' + name }],
            } });
          }
          return;
        }
      });
      serverPost('mcp-server-ready');
    </script>
  </body>
</html>`;

describe.skipIf(!canLaunchBrowser)('WebMCP integration', () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  describe('bridge against a real page', () => {
    let browser: AgentBrowser;

    beforeAll(async () => {
      browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'shared', webmcp: { enabled: true } });
      await browser.ensureReady();
      await browser.goto({ url });
    }, 30_000);

    afterAll(async () => {
      await browser.close();
    }, 10_000);

    it('discovers tools from both protocols on one page', async () => {
      const result = await browser.listWebMcpTools();
      expect(result.success).toBe(true);
      if (!result.success) return;
      const byName = new Map(result.tools.map(t => [t.name, t]));
      expect([...byName.keys()].sort()).toEqual(['add_to_cart', 'get_cart', 'get_price']);
      expect(byName.get('get_cart')?.source).toBe('w3c');
      expect(byName.get('get_price')?.source).toBe('mcpb');
      expect(byName.get('add_to_cart')?.inputSchema).toEqual({
        type: 'object',
        properties: { sku: { type: 'string' }, qty: { type: 'number' } },
        required: ['sku', 'qty'],
      });
    });

    it('calls an MCP-B tool over JSON-RPC and a W3C tool reads the mutated state', async () => {
      const added = await browser.callWebMcpTool({ toolName: 'add_to_cart', args: { sku: 'sku-42', qty: 2 } });
      expect(added.success).toBe(true);
      if (added.success) expect(added.result).toEqual({ ok: true, cartSize: 1 });

      const cart = await browser.callWebMcpTool({ toolName: 'get_cart' });
      expect(cart.success).toBe(true);
      if (cart.success) expect(cart.result).toEqual({ items: [{ sku: 'sku-42', qty: 2 }] });

      // Independent check straight from the page, bypassing the bridge.
      const page = await getPage(browser);
      await expect(page.evaluate('cart')).resolves.toEqual([{ sku: 'sku-42', qty: 2 }]);
      await expect(page.title()).resolves.toBe('WebMCP Shop (cart: 1)');
    });

    it('unwraps single-text-content JSON results from MCP tool calls', async () => {
      const result = await browser.callWebMcpTool({ toolName: 'get_price', args: { sku: 'sku-1' } });
      expect(result.success).toBe(true);
      if (result.success) expect(result.result).toEqual({ sku: 'sku-1', priceCents: 129900 });
    });

    it('rejects W3C tool calls whose args violate the declared inputSchema', async () => {
      // get_cart declares an empty object schema; add a schema'd tool to exercise validation.
      const page = await getPage(browser);
      await page.evaluate(`navigator.modelContext.registerTool({
        name: 'buy',
        description: 'Buy a product',
        inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
        execute: function (args) { return args; },
      })`);
      const bad = await browser.callWebMcpTool({ toolName: 'buy', args: { notSku: 1 } });
      expect(bad.success).toBe(false);
      if (!bad.success) expect(bad.message).toMatch(/missing required property "sku"/);
    });

    it('surfaces isError MCP results as tool errors', async () => {
      // 'nope' reaches the page server, which reports an isError result.
      const result = await browser.callWebMcpTool({ toolName: 'nope' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.message).toMatch(/unknown tool: nope/);
    });
  });

  describe('configuration against a real page', () => {
    it("protocols: ['w3c'] exposes the shim but never talks to the page MCP server", async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, protocols: ['w3c'] },
      });
      try {
        await browser.ensureReady();
        await browser.goto({ url });
        const result = await browser.listWebMcpTools();
        expect(result.success).toBe(true);
        if (result.success) expect(result.tools.map(t => t.name)).toEqual(['get_cart']);
      } finally {
        await browser.close();
      }
    }, 30_000);

    it("protocols: ['mcpb'] does not install navigator.modelContext", async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, protocols: ['mcpb'] },
      });
      try {
        await browser.ensureReady();
        // The page's registerTool call throws without the shim; assert before load.
        const page = await getPage(browser);
        await page.goto('about:blank');
        await expect(page.evaluate('typeof navigator.modelContext')).resolves.toBe('undefined');
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('rejects pages whose origin is not in allowedOrigins', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, allowedOrigins: ['https://allowed.example'] },
      });
      try {
        await browser.ensureReady();
        await browser.goto({ url });
        const result = await browser.listWebMcpTools();
        expect(result.success).toBe(false);
        if (!result.success) expect(result.message).toMatch(/not allowed by configuration/);
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('fails closed when the page navigates after the allowlist check (TOCTOU)', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, allowedOrigins: ['https://allowed.example'] },
      });
      try {
        await browser.ensureReady();
        await browser.goto({ url });
        // Simulate the delayed-navigation race deterministically: the host
        // reads `page.url()` (allowed origin) but by the time the evaluate
        // runs, the document really sits on a different origin. The in-page
        // re-check against `location.origin` must reject it.
        const page = await getPage(browser);
        (page as unknown as { url: () => string }).url = () => 'https://allowed.example/';
        const list = await browser.listWebMcpTools();
        expect(list.success).toBe(false);
        if (!list.success) expect(list.message).toMatch(/navigated/);
        const call = await browser.callWebMcpTool({ toolName: 'get_cart' });
        expect(call.success).toBe(false);
        if (!call.success) expect(call.message).toMatch(/navigated/);
      } finally {
        await browser.close();
      }
    }, 30_000);
  });

  describe('full agent loop with the real toolset', () => {
    it('an Agent discovers and calls page tools in manual mode via browser_webmcp_discover', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, toolDiscovery: 'manual' },
      });

      // Script: goto → discover (attaches page tools) → page_add_to_cart → page_get_cart → finish.
      const script: Array<{ toolName: string; input: Record<string, unknown> } | { text: string }> = [
        { toolName: 'browser_goto', input: { url: '__URL__' } },
        { toolName: 'browser_webmcp_discover', input: {} },
        { toolName: 'page_add_to_cart', input: { sku: 'sku-7', qty: 3 } },
        { toolName: 'page_get_cart', input: {} },
        { text: 'Added 3x sku-7 to the cart.' },
      ];
      let step = 0;

      const scriptedModel = {
        specificationVersion: 'v2' as const,
        provider: 'mock',
        modelId: 'scripted-webmcp-test',
        supportedUrls: {},
        doGenerate: async () => {
          const current = script[Math.min(step, script.length - 1)]!;
          step++;
          const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
          if ('toolName' in current) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage,
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${step}`,
                  toolName: current.toolName,
                  input: JSON.stringify(current.toolName === 'browser_goto' ? { url } : current.input),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage,
            content: [{ type: 'text' as const, text: current.text }],
            warnings: [],
          };
        },
        doStream: async () => {
          const current = script[Math.min(step, script.length - 1)]!;
          step++;
          const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
          const meta: unknown[] = [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${step}`, modelId: 'scripted-webmcp-test', timestamp: new Date(0) },
          ];
          const chunks: unknown[] =
            'toolName' in current
              ? [
                  ...meta,
                  {
                    type: 'tool-call',
                    toolCallId: `call-${step}`,
                    toolName: current.toolName,
                    input: JSON.stringify(current.toolName === 'browser_goto' ? { url } : current.input),
                    providerExecuted: false,
                  },
                  { type: 'finish', finishReason: 'tool-calls', usage },
                ]
              : [
                  ...meta,
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: current.text },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage },
                ];
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream<unknown>({
              start(controller) {
                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
              },
            }),
          };
        },
      };

      const agent = new Agent({
        id: 'webmcp-test-agent',
        name: 'WebMCP test agent',
        instructions: 'Call browser_webmcp_discover after navigating, then call the attached page tools.',
        model: scriptedModel as never,
        tools: browser.getTools() as never,
      });

      try {
        const result = await agent.generate('Add 3 of sku-7 to the cart.', {
          maxSteps: 8,
          prepareStep: browser.prepareStep as never,
        });
        expect(result.text).toBe('Added 3x sku-7 to the cart.');

        const toolNames = result.steps.flatMap(s => (s.toolCalls ?? []).map(c => c.payload.toolName));
        expect(toolNames).toEqual(['browser_goto', 'browser_webmcp_discover', 'page_add_to_cart', 'page_get_cart']);

        // The agent's tool call mutated real page state.
        const page = await getPage(browser);
        await expect(page.evaluate('cart')).resolves.toEqual([{ sku: 'sku-7', qty: 3 }]);
      } finally {
        await browser.close();
      }
    }, 60_000);

    it('an Agent calls first-class page tools via browser.prepareStep (auto mode)', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });

      // Note: no discover tool. In auto mode, page tools are auto-merged every
      // step. The scripted model goes straight from browser_goto to the
      // first-class page_* tools.
      const script: Array<{ toolName: string; input: Record<string, unknown> } | { text: string }> = [
        { toolName: 'browser_goto', input: { url: '__URL__' } },
        { toolName: 'page_add_to_cart', input: { sku: 'sku-9', qty: 2 } },
        { toolName: 'page_get_cart', input: {} },
        { text: 'Added 2x sku-9 to the cart.' },
      ];
      let step = 0;
      // Record what the model saw each step so we can verify the toolset grew
      // after the goto resolved.
      const toolNamesByStep: string[][] = [];

      const scriptedModel = {
        specificationVersion: 'v2' as const,
        provider: 'mock',
        modelId: 'scripted-webmcp-prepare-step-test',
        supportedUrls: {},
        doGenerate: async (opts: { tools?: Array<{ name: string }> }) => {
          toolNamesByStep.push((opts.tools ?? []).map(t => t.name).sort());
          const current = script[Math.min(step, script.length - 1)]!;
          step++;
          const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
          if ('toolName' in current) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage,
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${step}`,
                  toolName: current.toolName,
                  input: JSON.stringify(current.toolName === 'browser_goto' ? { url } : current.input),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage,
            content: [{ type: 'text' as const, text: current.text }],
            warnings: [],
          };
        },
        doStream: async (opts: { tools?: Array<{ name: string }> }) => {
          toolNamesByStep.push((opts.tools ?? []).map(t => t.name).sort());
          const current = script[Math.min(step, script.length - 1)]!;
          step++;
          const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
          const meta: unknown[] = [
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `id-${step}`,
              modelId: 'scripted-webmcp-prepare-step-test',
              timestamp: new Date(0),
            },
          ];
          const chunks: unknown[] =
            'toolName' in current
              ? [
                  ...meta,
                  {
                    type: 'tool-call',
                    toolCallId: `call-${step}`,
                    toolName: current.toolName,
                    input: JSON.stringify(current.toolName === 'browser_goto' ? { url } : current.input),
                    providerExecuted: false,
                  },
                  { type: 'finish', finishReason: 'tool-calls', usage },
                ]
              : [
                  ...meta,
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: current.text },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage },
                ];
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream<unknown>({
              start(controller) {
                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
              },
            }),
          };
        },
      };

      const agent = new Agent({
        id: 'webmcp-prepare-step-test-agent',
        name: 'WebMCP prepareStep test agent',
        instructions: 'Use the available page_* tools to update the cart.',
        model: scriptedModel as never,
        tools: browser.getTools() as never,
      });

      try {
        const result = await agent.generate('Add 2 of sku-9 to the cart.', {
          maxSteps: 8,
          prepareStep: browser.prepareStep as never,
        });
        expect(result.text).toBe('Added 2x sku-9 to the cart.');

        const toolNames = result.steps.flatMap(s => (s.toolCalls ?? []).map(c => c.payload.toolName));
        expect(toolNames).toEqual(['browser_goto', 'page_add_to_cart', 'page_get_cart']);

        // Step 0 (initial): no page tools yet (browser is on about:blank).
        // Step 1+: page tools present after browser_goto resolved.
        expect(toolNamesByStep[0]).not.toContain('page_add_to_cart');
        expect(toolNamesByStep[1]).toContain('page_add_to_cart');
        expect(toolNamesByStep[1]).toContain('page_get_cart');

        // Real page state was mutated by the first-class tool.
        const page = await getPage(browser);
        await expect(page.evaluate('cart')).resolves.toEqual([{ sku: 'sku-9', qty: 2 }]);
      } finally {
        await browser.close();
      }
    }, 60_000);
  });
});
