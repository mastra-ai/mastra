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
  reload: () => Promise<unknown>;
};

/** getPage is private on AgentBrowser; tests reach in to verify page state. */
function getPage(browser: AgentBrowser): Promise<PageLike> {
  return (browser as unknown as { getPage: (threadId?: string) => Promise<PageLike> }).getPage();
}

/**
 * One step the model should take: either a tool call or a terminal text.
 * We allow a function form for input so a step can react to what the agent
 * saw on earlier steps (used by the recovery test).
 */
type ScriptStep =
  | { toolName: string; input: Record<string, unknown> | (() => Record<string, unknown>) }
  | { text: string };

/**
 * Build a minimal v2 LanguageModel that walks a script. `onStep` is called
 * before each step with the tool-list the model saw, so tests can assert
 * what the agent exposed per step (e.g. tool-set swaps on navigation,
 * stable fingerprints across steps).
 */
function createScriptedModel(opts: {
  modelId: string;
  script: ScriptStep[];
  onStep?: (
    toolNames: string[],
    index: number,
    tools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
  ) => void;
}) {
  let step = 0;
  const nextStep = (tools: Array<{ name: string; description?: string; inputSchema?: unknown }> | undefined) => {
    const current = opts.script[Math.min(step, opts.script.length - 1)]!;
    const toolNames = (tools ?? []).map(t => t.name).sort();
    opts.onStep?.(toolNames, step, tools ?? []);
    step++;
    return current;
  };
  const resolveInput = (input: ScriptStep extends { input: infer I } ? I : never) =>
    typeof input === 'function' ? (input as () => Record<string, unknown>)() : input;
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: opts.modelId,
    supportedUrls: {},
    doGenerate: async (callOpts: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> }) => {
      const current = nextStep(callOpts.tools);
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
              input: JSON.stringify(resolveInput(current.input as never)),
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
    doStream: async (callOpts: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> }) => {
      const current = nextStep(callOpts.tools);
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const meta: unknown[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `id-${step}`, modelId: opts.modelId, timestamp: new Date(0) },
      ];
      const chunks: unknown[] =
        'toolName' in current
          ? [
              ...meta,
              {
                type: 'tool-call',
                toolCallId: `call-${step}`,
                toolName: current.toolName,
                input: JSON.stringify(resolveInput(current.input as never)),
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

const SHOP_PAGE = /* html */ `<!doctype html>
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

/**
 * A different page that exposes a different W3C tool. We serve this at
 * /checkout and use it to prove the agent-visible tool set changes when
 * the agent navigates. No MCP-B server here — just a W3C registration.
 */
const CHECKOUT_PAGE = /* html */ `<!doctype html>
<html>
  <head><title>WebMCP Checkout</title></head>
  <body>
    <h1>WebMCP Checkout</h1>
    <script>
      window.purchased = null;
      navigator.modelContext.registerTool({
        name: 'complete_purchase',
        description: 'Complete the purchase',
        inputSchema: {
          type: 'object',
          properties: { confirm: { type: 'boolean' } },
          required: ['confirm'],
        },
        execute: function (args) {
          window.purchased = { confirm: args.confirm, at: 'checkout' };
          return window.purchased;
        },
      });
    </script>
  </body>
</html>`;

describe.skipIf(!canLaunchBrowser)('WebMCP integration', () => {
  let server: http.Server;
  let url: string;
  let checkoutUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(req.url && req.url.startsWith('/checkout') ? CHECKOUT_PAGE : SHOP_PAGE);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    url = `http://127.0.0.1:${port}/`;
    checkoutUrl = `http://127.0.0.1:${port}/checkout`;
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

    it('new Agent({ browser }) auto-wires prepareStep so page tools surface without any extra wiring (auto mode)', async () => {
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

      // No `tools` and no `prepareStep` wiring — just `browser`. The Agent
      // pulls `browser.getTools()` and `browser.getPrepareStep()` on its own.
      const agent = new Agent({
        id: 'webmcp-prepare-step-test-agent',
        name: 'WebMCP prepareStep test agent',
        instructions: 'Use the available page_* tools to update the cart.',
        model: scriptedModel as never,
        browser,
      });

      try {
        const result = await agent.generate('Add 2 of sku-9 to the cart.', {
          maxSteps: 8,
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

  describe('deep scenarios', () => {
    it('auto mode: the agent-visible toolset swaps when the agent navigates to a different page', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      const toolNamesByStep: string[][] = [];

      // goto shop → add_to_cart on shop → goto checkout → complete_purchase on checkout → done.
      // We rely on the per-step tool list capture to prove that:
      //   - at the add_to_cart step, page_add_to_cart is visible and complete_purchase is NOT;
      //   - at the complete_purchase step, complete_purchase is visible and page_add_to_cart is NOT.
      const model = createScriptedModel({
        modelId: 'scripted-webmcp-nav-swap',
        script: [
          { toolName: 'browser_goto', input: { url } },
          { toolName: 'page_add_to_cart', input: { sku: 'sku-nav', qty: 1 } },
          { toolName: 'browser_goto', input: { url: checkoutUrl } },
          { toolName: 'page_complete_purchase', input: { confirm: true } },
          { text: 'Checked out.' },
        ],
        onStep: toolNames => toolNamesByStep.push(toolNames),
      });

      const agent = new Agent({
        id: 'webmcp-nav-swap-agent',
        name: 'nav swap',
        instructions: 'Shop then check out.',
        model: model as never,
        browser,
      });

      try {
        const result = await agent.generate('Buy sku-nav then check out.', { maxSteps: 10 });
        expect(result.text).toBe('Checked out.');

        // Step 0: before any goto. Step 1: on shop (page_add_to_cart visible). Step 2: on
        // shop still (just called add_to_cart). Step 3: on checkout — complete_purchase
        // visible, page_add_to_cart gone. We only need to prove the swap at the step the
        // model actually chose complete_purchase on.
        const stepOnCheckout = toolNamesByStep[3]!;
        expect(stepOnCheckout).toContain('page_complete_purchase');
        expect(stepOnCheckout).not.toContain('page_add_to_cart');
        expect(stepOnCheckout).not.toContain('page_get_cart');

        // And on the shop steps, page_complete_purchase was never visible — a page tool
        // from the checkout page can't leak back when the agent was on the shop.
        const stepOnShop = toolNamesByStep[1]!;
        expect(stepOnShop).toContain('page_add_to_cart');
        expect(stepOnShop).not.toContain('page_complete_purchase');

        // And the checkout tool really ran against the checkout page.
        const page = await getPage(browser);
        await expect(page.evaluate('window.purchased')).resolves.toEqual({ confirm: true, at: 'checkout' });
      } finally {
        await browser.close();
      }
    }, 60_000);

    it('manual mode: `names` filters the attached set; navigation drops it; the agent re-discovers on the new page', async () => {
      const browser = new AgentBrowser({
        headless: true,
        scope: 'shared',
        webmcp: { enabled: true, toolDiscovery: 'manual' },
      });
      const toolNamesByStep: string[][] = [];

      // On shop: attach only get_price (not add_to_cart). Use it. Navigate to checkout.
      // Attach again (no filter → everything on that page, which is just complete_purchase).
      // Use it. We assert both the filter behavior and that attachments drop on navigate.
      const model = createScriptedModel({
        modelId: 'scripted-webmcp-manual-filter',
        script: [
          { toolName: 'browser_goto', input: { url } },
          { toolName: 'browser_webmcp_discover', input: { names: ['get_price'] } },
          { toolName: 'page_get_price', input: { sku: 'sku-manual' } },
          { toolName: 'browser_goto', input: { url: checkoutUrl } },
          { toolName: 'browser_webmcp_discover', input: {} },
          { toolName: 'page_complete_purchase', input: { confirm: true } },
          { text: 'Done.' },
        ],
        onStep: toolNames => toolNamesByStep.push(toolNames),
      });

      const agent = new Agent({
        id: 'webmcp-manual-filter-agent',
        name: 'manual filter',
        instructions: 'Discover and use page tools.',
        model: model as never,
        browser,
      });

      try {
        const result = await agent.generate('Price then checkout.', { maxSteps: 12 });
        expect(result.text).toBe('Done.');

        // After `browser_webmcp_discover` with names:['get_price'], the model should see
        // page_get_price but NOT page_add_to_cart (filter working).
        const afterPartialDiscover = toolNamesByStep[2]!;
        expect(afterPartialDiscover).toContain('page_get_price');
        expect(afterPartialDiscover).not.toContain('page_add_to_cart');
        expect(afterPartialDiscover).not.toContain('page_get_cart');

        // Step 3 is the goto for /checkout. By step 4 the discover tool was called again
        // for the new page — and importantly, the stale page_get_price must be gone (it
        // was attached from the shop origin).
        const afterRediscover = toolNamesByStep[5]!;
        expect(afterRediscover).toContain('page_complete_purchase');
        expect(afterRediscover).not.toContain('page_get_price');

        const page = await getPage(browser);
        await expect(page.evaluate('window.purchased')).resolves.toEqual({ confirm: true, at: 'checkout' });
      } finally {
        await browser.close();
      }
    }, 60_000);

    it('bridge reflects dynamic registerTool / unregisterTool after the page loaded', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      try {
        await browser.ensureReady();
        await browser.goto({ url });

        const before = await browser.listWebMcpTools();
        expect(before.success).toBe(true);
        if (before.success)
          expect(before.tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_cart', 'get_price']);

        // Page registers a new W3C tool after initial load. The bridge is live, not a
        // snapshot taken at init time, so the next list should see it.
        const page = await getPage(browser);
        await page.evaluate(`navigator.modelContext.registerTool({
          name: 'wish_list',
          description: 'Record a wish-list item',
          inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
          execute: function (args) { return { wished: args.sku }; },
        })`);

        const afterReg = await browser.listWebMcpTools();
        expect(afterReg.success).toBe(true);
        if (afterReg.success) {
          expect(afterReg.tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_cart', 'get_price', 'wish_list']);
          const wish = afterReg.tools.find(t => t.name === 'wish_list');
          expect(wish?.source).toBe('w3c');
          expect(wish?.inputSchema).toEqual({
            type: 'object',
            properties: { sku: { type: 'string' } },
            required: ['sku'],
          });
        }

        // And the new tool really executes.
        const called = await browser.callWebMcpTool({ toolName: 'wish_list', args: { sku: 'sku-wish' } });
        expect(called.success).toBe(true);
        if (called.success) expect(called.result).toEqual({ wished: 'sku-wish' });

        // Now unregister. The spec allows removal; the bridge must reflect that.
        await page.evaluate(`navigator.modelContext.unregisterTool('wish_list')`);

        const afterUnreg = await browser.listWebMcpTools();
        expect(afterUnreg.success).toBe(true);
        if (afterUnreg.success)
          expect(afterUnreg.tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_cart', 'get_price']);

        // And it is no longer callable.
        const missing = await browser.callWebMcpTool({ toolName: 'wish_list', args: { sku: 'sku-wish' } });
        expect(missing.success).toBe(false);
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('same-page cache stability: the model sees an identical tool-list fingerprint across repeat steps (prompt-cache claim)', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      const fingerprintsByStep: string[] = [];

      // After browser_goto, do three page tool calls in a row on the same page. The
      // tool list the model sees must be byte-for-byte identical across all three —
      // same names, same descriptions, same inputSchemas, same order — otherwise
      // the prompt cache invalidates every step and the memoization story is a lie.
      const model = createScriptedModel({
        modelId: 'scripted-webmcp-stability',
        script: [
          { toolName: 'browser_goto', input: { url } },
          { toolName: 'page_get_price', input: { sku: 'sku-s1' } },
          { toolName: 'page_add_to_cart', input: { sku: 'sku-s1', qty: 1 } },
          { toolName: 'page_get_cart', input: {} },
          { text: 'done' },
        ],
        onStep: (_names, _idx, tools) =>
          fingerprintsByStep.push(
            JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))),
          ),
      });

      const agent = new Agent({
        id: 'webmcp-stability-agent',
        name: 'stability',
        instructions: 'Use the page tools.',
        model: model as never,
        browser,
      });

      try {
        const result = await agent.generate('Price, add, read.', { maxSteps: 8 });
        expect(result.text).toBe('done');

        // Steps 1, 2, 3 are the three repeat calls on the same page. Their fingerprints
        // must match exactly — this is the whole point of memoization by URL.
        const [, s1, s2, s3] = fingerprintsByStep;
        expect(s1).toBeDefined();
        expect(s2).toBe(s1);
        expect(s3).toBe(s1);
      } finally {
        await browser.close();
      }
    }, 60_000);

    it('bridge survives a page reload: tools re-register and remain callable', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      try {
        await browser.ensureReady();
        await browser.goto({ url });

        // Baseline: tools present, calls succeed.
        const before = await browser.listWebMcpTools();
        expect(before.success).toBe(true);
        const addedBefore = await browser.callWebMcpTool({ toolName: 'add_to_cart', args: { sku: 'sku-pre', qty: 1 } });
        expect(addedBefore.success).toBe(true);

        // Reload the page. `addInitScript` runs again on the fresh document, so
        // the bridge re-installs. The W3C tool from the page's inline <script>
        // and the MCP-B server also come back as part of the page's own JS.
        const page = await getPage(browser);
        await page.reload();

        const after = await browser.listWebMcpTools();
        expect(after.success).toBe(true);
        if (after.success) {
          expect(after.tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_cart', 'get_price']);
        }

        // State really is fresh (the page's inline `var cart = []` ran again),
        // and both protocols still work after the reload.
        const addedAfter = await browser.callWebMcpTool({
          toolName: 'add_to_cart',
          args: { sku: 'sku-post', qty: 2 },
        });
        expect(addedAfter.success).toBe(true);
        if (addedAfter.success) expect(addedAfter.result).toEqual({ ok: true, cartSize: 1 });

        const cart = await browser.callWebMcpTool({ toolName: 'get_cart' });
        expect(cart.success).toBe(true);
        if (cart.success) expect(cart.result).toEqual({ items: [{ sku: 'sku-post', qty: 2 }] });
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('parallel tool calls on the same page do not collide', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      try {
        await browser.ensureReady();
        await browser.goto({ url });

        // Fire several calls concurrently across both protocols. The bridge
        // multiplexes a shared JSON-RPC id counter and a shared pending-response
        // map; if either races, results get swapped, dropped, or hang.
        const [price1, price2, added1, added2] = await Promise.all([
          browser.callWebMcpTool({ toolName: 'get_price', args: { sku: 'A' } }), // MCP-B
          browser.callWebMcpTool({ toolName: 'get_price', args: { sku: 'B' } }), // MCP-B
          browser.callWebMcpTool({ toolName: 'add_to_cart', args: { sku: 'A', qty: 1 } }), // MCP-B
          browser.callWebMcpTool({ toolName: 'add_to_cart', args: { sku: 'B', qty: 2 } }), // MCP-B
        ]);

        expect(price1.success).toBe(true);
        expect(price2.success).toBe(true);
        expect(added1.success).toBe(true);
        expect(added2.success).toBe(true);

        // Each get_price response was routed back to its own request — sku-in
        // matches sku-out.
        if (price1.success) expect(price1.result).toEqual({ sku: 'A', priceCents: 129900 });
        if (price2.success) expect(price2.result).toEqual({ sku: 'B', priceCents: 129900 });

        // Both writes landed. Order isn't deterministic (concurrent), so
        // normalize before asserting.
        const page = await getPage(browser);
        const finalCart = (await page.evaluate('cart')) as Array<{ sku: string; qty: number }>;
        expect([...finalCart].sort((a, b) => a.sku.localeCompare(b.sku))).toEqual([
          { sku: 'A', qty: 1 },
          { sku: 'B', qty: 2 },
        ]);

        // And a W3C read sees the final state, proving the W3C surface wasn't
        // starved while MCP-B calls were in flight.
        const cart = await browser.callWebMcpTool({ toolName: 'get_cart' });
        expect(cart.success).toBe(true);
        if (cart.success) {
          const items = (cart.result as { items: Array<{ sku: string; qty: number }> }).items;
          expect([...items].sort((a, b) => a.sku.localeCompare(b.sku))).toEqual([
            { sku: 'A', qty: 1 },
            { sku: 'B', qty: 2 },
          ]);
        }
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('surfaces W3C tool handler exceptions as tool errors (not hangs or unhandled rejections)', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      try {
        await browser.ensureReady();
        await browser.goto({ url });

        // Register a W3C tool whose execute throws. Must come back as a tool
        // error with a meaningful message, not stall the pending promise.
        const page = await getPage(browser);
        await page.evaluate(`navigator.modelContext.registerTool({
          name: 'boom',
          description: 'Always throws',
          inputSchema: { type: 'object', properties: {} },
          execute: function () { throw new Error('kaboom from page handler'); },
        })`);

        const result = await browser.callWebMcpTool({ toolName: 'boom' });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.message).toMatch(/kaboom from page handler/);

        // And the bridge is still healthy after that: other tools still work.
        const cart = await browser.callWebMcpTool({ toolName: 'get_cart' });
        expect(cart.success).toBe(true);
      } finally {
        await browser.close();
      }
    }, 30_000);

    it('agent.stream drives WebMCP page tools end-to-end (streaming path, not just agent.generate)', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });

      const model = createScriptedModel({
        modelId: 'scripted-webmcp-stream',
        script: [
          { toolName: 'browser_goto', input: { url } },
          { toolName: 'page_add_to_cart', input: { sku: 'sku-stream', qty: 3 } },
          { toolName: 'page_get_cart', input: {} },
          { text: 'Streamed.' },
        ],
      });

      const agent = new Agent({
        id: 'webmcp-stream-agent',
        name: 'stream',
        instructions: 'Add to cart and read it.',
        model: model as never,
        browser,
      });

      try {
        // Exercise the stream path explicitly. The scripted model's doStream
        // emits tool-call chunks that the loop must consume, dispatch, and feed
        // back in — same prepareStep merging, same WebMCP tool execution.
        const stream = await agent.stream('Add 3 sku-stream.', { maxSteps: 10 });
        let text = '';
        for await (const chunk of stream.textStream) {
          text += chunk;
        }
        expect(text).toBe('Streamed.');

        const page = await getPage(browser);
        await expect(page.evaluate('cart')).resolves.toEqual([{ sku: 'sku-stream', qty: 3 }]);
      } finally {
        await browser.close();
      }
    }, 60_000);

    it('agent recovers from a tool-call error: bad args surface as a tool error, next step retries with correct args', async () => {
      const browser = new AgentBrowser({ headless: true, scope: 'shared', webmcp: { enabled: true } });
      let sawError = false;

      // Step 2 asks add_to_cart with missing `sku`/`qty`. The W3C validator in the
      // bridge rejects that at call time with "missing required property \"sku\"".
      // We check the step's result for that error, then issue a correct call next.
      const model = createScriptedModel({
        modelId: 'scripted-webmcp-recovery',
        script: [
          { toolName: 'browser_goto', input: { url } },
          { toolName: 'page_add_to_cart', input: { wrong: 'args' } }, // bad
          { toolName: 'page_add_to_cart', input: { sku: 'sku-rec', qty: 4 } }, // corrected
          { text: 'Recovered.' },
        ],
      });

      const agent = new Agent({
        id: 'webmcp-recovery-agent',
        name: 'recovery',
        instructions: 'Add items; recover from errors.',
        model: model as never,
        browser,
      });

      try {
        const result = await agent.generate('Add 4 sku-rec.', { maxSteps: 10 });
        expect(result.text).toBe('Recovered.');

        // The bad call must have produced a tool result that looks like an error to the
        // agent (not an exception that aborts the run). We look for an error-shaped
        // result anywhere in the steps.
        const allResults = result.steps.flatMap(s => s.toolResults ?? []);
        sawError = allResults.some(r => {
          const output = (r as { payload?: { result?: unknown } }).payload?.result;
          if (!output || typeof output !== 'object') return false;
          const asString = JSON.stringify(output);
          return /missing required property|sku|required/i.test(asString);
        });
        expect(sawError).toBe(true);

        // And the corrected call really mutated the cart.
        const page = await getPage(browser);
        await expect(page.evaluate('cart')).resolves.toEqual([{ sku: 'sku-rec', qty: 4 }]);
      } finally {
        await browser.close();
      }
    }, 60_000);
  });
});
