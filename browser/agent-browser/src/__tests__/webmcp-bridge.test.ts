/**
 * Tests for the WebMCP in-page bridge.
 *
 * Executes the real init script against a vm context with a mock navigator
 * and a postMessage bus, so we're exercising the exact code Playwright
 * injects into the page. The MCP-B tests run a fake in-page MCP server that
 * speaks the real `@mcp-b/transports` Tab transport wire format:
 * `{ channel, type: 'mcp', direction, payload }` envelopes with the
 * `mcp-check-ready` / `mcp-server-ready` handshake and JSON-RPC payloads.
 */
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import type { WebmcpProtocol } from '../types';
import { buildWebMcpInitScript } from '../webmcp-bridge';

type Sandbox = Record<string, unknown>;

/** window.postMessage/addEventListener bus + location, inside the sandbox. */
const MESSAGE_BUS = /* js */ `
  var __listeners = [];
  window.addEventListener = function (type, fn) {
    if (type === 'message') __listeners.push(fn);
  };
  window.postMessage = function (data) {
    var ev = { source: window, origin: 'https://shop.test', data: data };
    __listeners.slice().forEach(function (fn) {
      setTimeout(function () { fn(ev); }, 0);
    });
  };
  window.location = { origin: 'https://shop.test' };
`;

/**
 * A fake in-page MCP server speaking the Tab transport wire format, as a
 * sandbox-side script. Mirrors TabServerTransport behavior: broadcasts
 * 'mcp-server-ready' on start, answers 'mcp-check-ready', and serves
 * initialize / tools/list / tools/call over JSON-RPC payloads.
 */
const FAKE_MCP_SERVER = /* js */ `
  var serverState = { cart: [], receivedInitialized: false };
  function serverPost(payload) {
    window.postMessage({ channel: 'mcp-default', type: 'mcp', direction: 'server-to-client', payload: payload });
  }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.channel !== 'mcp-default' || d.type !== 'mcp' || d.direction !== 'client-to-server') return;
    var p = d.payload;
    if (p === 'mcp-check-ready') { serverPost('mcp-server-ready'); return; }
    if (!p || typeof p !== 'object') return;
    if (p.method === 'initialize') {
      serverPost({ jsonrpc: '2.0', id: p.id, result: {
        protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fake-shop', version: '1.0.0' },
      } });
      return;
    }
    if (p.method === 'notifications/initialized') { serverState.receivedInitialized = true; return; }
    if (p.method === 'tools/list') {
      serverPost({ jsonrpc: '2.0', id: p.id, result: { tools: [
        { name: 'get_price', description: 'Get the price of a SKU',
          inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] } },
        { name: 'add_to_cart', description: 'Add a SKU to the cart',
          inputSchema: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'number' } }, required: ['sku'] } },
      ] } });
      return;
    }
    if (p.method === 'tools/call') {
      var name = p.params && p.params.name;
      var args = (p.params && p.params.arguments) || {};
      if (name === 'get_price') {
        serverPost({ jsonrpc: '2.0', id: p.id, result: {
          content: [{ type: 'text', text: JSON.stringify({ sku: args.sku, cents: 1999 }) }],
        } });
      } else if (name === 'add_to_cart') {
        serverState.cart.push({ sku: args.sku, qty: args.qty || 1 });
        serverPost({ jsonrpc: '2.0', id: p.id, result: {
          structuredContent: { ok: true, cartSize: serverState.cart.length },
          content: [{ type: 'text', text: 'added' }],
        } });
      } else if (name === 'explode') {
        serverPost({ jsonrpc: '2.0', id: p.id, result: {
          isError: true, content: [{ type: 'text', text: 'the page tool blew up' }],
        } });
      } else {
        serverPost({ jsonrpc: '2.0', id: p.id, error: { code: -32602, message: 'Unknown tool: ' + name } });
      }
      return;
    }
  });
  serverPost('mcp-server-ready');
`;

function makeSandbox(opts?: {
  existingModelContext?: unknown;
  protocols?: WebmcpProtocol[];
  /** Install the fake MCP server before the bridge (server-first page). */
  mcpServer?: boolean;
  /** Install the fake MCP server after the bridge (normal page-load order). */
  mcpServerAfterBridge?: boolean;
}) {
  const sandbox: Sandbox = { setTimeout, clearTimeout };
  sandbox.navigator = { ...(opts?.existingModelContext ? { modelContext: opts.existingModelContext } : {}) };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(MESSAGE_BUS, sandbox);
  if (opts?.mcpServer) vm.runInContext(FAKE_MCP_SERVER, sandbox);
  vm.runInContext(buildWebMcpInitScript(opts?.protocols ?? ['mcpb', 'w3c']), sandbox);
  if (opts?.mcpServerAfterBridge) vm.runInContext(FAKE_MCP_SERVER, sandbox);
  return sandbox;
}

function list(sandbox: Sandbox): Promise<Array<Record<string, unknown>>> {
  return vm.runInContext('__mastraWebMcp.list()', sandbox) as Promise<Array<Record<string, unknown>>>;
}

function call(sandbox: Sandbox, expr: string): Promise<unknown> {
  return vm.runInContext(`__mastraWebMcp.call(${expr})`, sandbox) as Promise<unknown>;
}

describe('WebMCP bridge: W3C navigator.modelContext', () => {
  it('captures tools registered via navigator.modelContext.registerTool', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({
         name: 'add',
         description: 'Add two numbers',
         inputSchema: { type: 'object', properties: { a: { type: 'number' } } },
         execute: ({ a, b }) => a + b,
       })`,
      sandbox,
    );
    await expect(list(sandbox)).resolves.toEqual([
      {
        name: 'add',
        source: 'w3c',
        description: 'Add two numbers',
        inputSchema: { type: 'object', properties: { a: { type: 'number' } } },
      },
    ]);
  });

  it('invokes registered execute functions via __mastraWebMcp.call', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({
         name: 'greet',
         description: 'Say hello',
         execute: ({ who }) => 'hello ' + who,
       })`,
      sandbox,
    );
    await expect(call(sandbox, `'greet', { who: 'world' }`)).resolves.toBe('hello world');
  });

  it('registerTool throws InvalidStateError on duplicate names (per spec)', () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'dup', description: 'd', execute: () => 1 })`,
      sandbox,
    );
    expect(() =>
      vm.runInContext(
        `navigator.modelContext.registerTool({ name: 'dup', description: 'd', execute: () => 2 })`,
        sandbox,
      ),
    ).toThrow(/already registered/);
  });

  it('registerTool throws on empty name or description (per spec)', () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    expect(() =>
      vm.runInContext(`navigator.modelContext.registerTool({ name: '', description: 'd' })`, sandbox),
    ).toThrow(/name must be a non-empty string/);
    expect(() =>
      vm.runInContext(`navigator.modelContext.registerTool({ name: 'x', description: '' })`, sandbox),
    ).toThrow(/description must be a non-empty string/);
  });

  it('registerTool rejects a non-object inputSchema (per spec)', () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    expect(() =>
      vm.runInContext(
        `navigator.modelContext.registerTool({ name: 'x', description: 'd', inputSchema: { type: 'string' } })`,
        sandbox,
      ),
    ).toThrow(/must describe an object/);
  });

  it('unregisterTool removes the tool and throws on unknown names (per spec)', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'gone', description: 'd', execute: () => 1 })`,
      sandbox,
    );
    vm.runInContext(`navigator.modelContext.unregisterTool('gone')`, sandbox);
    await expect(list(sandbox)).resolves.toEqual([]);
    expect(() => vm.runInContext(`navigator.modelContext.unregisterTool('gone')`, sandbox)).toThrow(/No tool named/);
  });

  it('provideContext replaces the full toolset (earlier-draft semantics)', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'old', description: 'd', execute: () => 0 })`,
      sandbox,
    );
    vm.runInContext(
      `navigator.modelContext.provideContext({
          tools: [
            { name: 'one', description: 'd1', execute: () => 1 },
            { name: 'two', description: 'd2', execute: () => 2 },
          ],
        })`,
      sandbox,
    );
    const names = (await list(sandbox)).map(t => t.name as string);
    expect(names.sort()).toEqual(['one', 'two']);
  });

  it('rejects call args that do not match the declared inputSchema', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({
         name: 'buy',
         description: 'Buy a product',
         inputSchema: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'integer' } }, required: ['sku'] },
         execute: (args) => args,
       })`,
      sandbox,
    );
    await expect(call(sandbox, `'buy', {}`)).rejects.toThrow(/missing required property "sku"/);
    await expect(call(sandbox, `'buy', { sku: 42 }`)).rejects.toThrow(/expected string, got number/);
    await expect(call(sandbox, `'buy', { sku: 'a', qty: 1.5 }`)).rejects.toThrow(/expected integer/);
    await expect(call(sandbox, `'buy', { sku: 'a', qty: 2 }`)).resolves.toEqual({ sku: 'a', qty: 2 });
  });

  it('throws when a tool has no execute function', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(`navigator.modelContext.registerTool({ name: 'bare', description: 'd' })`, sandbox);
    await expect(call(sandbox, `'bare', {}`)).rejects.toThrow(/no callable execute/);
  });

  it('throws on unknown tool names', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    await expect(call(sandbox, `'missing', {}`)).rejects.toThrow(/not registered/);
  });

  it('mirrors registrations into a pre-existing native modelContext', () => {
    const registered: unknown[] = [];
    const sandbox = makeSandbox({
      protocols: ['w3c'],
      existingModelContext: {
        registerTool: (def: unknown) => registered.push(def),
      },
    });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'both', description: 'd', execute: () => 1 })`,
      sandbox,
    );
    expect(registered).toHaveLength(1);
    expect((registered[0] as { name: string }).name).toBe('both');
  });

  it('re-entrant injection on the same context is a no-op', async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'] });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'keep', description: 'd', execute: () => 'kept' })`,
      sandbox,
    );
    vm.runInContext(buildWebMcpInitScript(['w3c']), sandbox);
    await expect(call(sandbox, `'keep', {}`)).resolves.toBe('kept');
  });
});

describe('WebMCP bridge: MCP-B Tab transport client', () => {
  it('lists tools from a page MCP server via the real wire format', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    const tools = await list(sandbox);
    expect(tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_price']);
    expect(tools.every(t => t.source === 'mcpb')).toBe(true);
    expect(tools.find(t => t.name === 'get_price')?.inputSchema).toEqual({
      type: 'object',
      properties: { sku: { type: 'string' } },
      required: ['sku'],
    });
  });

  it('completes the MCP handshake (initialize + notifications/initialized) before listing', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    await list(sandbox);
    expect(vm.runInContext('serverState.receivedInitialized', sandbox)).toBe(true);
  });

  it('detects a server that started before the bridge via the check-ready ping', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServer: true });
    const tools = await list(sandbox);
    expect(tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_price']);
  });

  it('calls a tool and unwraps a single-text-content JSON result', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    await expect(call(sandbox, `'get_price', { sku: 'sku-1' }`)).resolves.toEqual({ sku: 'sku-1', cents: 1999 });
  });

  it('prefers structuredContent and mutates real server state', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    await expect(call(sandbox, `'add_to_cart', { sku: 'sku-2', qty: 3 }`)).resolves.toEqual({ ok: true, cartSize: 1 });
    expect(vm.runInContext('serverState.cart', sandbox)).toEqual([{ sku: 'sku-2', qty: 3 }]);
  });

  it('surfaces isError tool results as errors', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    await expect(call(sandbox, `'explode', {}`)).rejects.toThrow(/the page tool blew up/);
  });

  it('surfaces JSON-RPC errors for unknown tools', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    await expect(call(sandbox, `'nope', {}`)).rejects.toThrow(/Unknown tool: nope/);
  });

  it('returns an empty list when no server is present on the page', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'] });
    await expect(list(sandbox)).resolves.toEqual([]);
  });

  it('rejects calls when no server is present on the page', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'] });
    await expect(call(sandbox, `'anything', {}`)).rejects.toThrow(/not registered/);
  });
});

describe('WebMCP bridge: protocol scoping and precedence', () => {
  it('W3C registrations shadow same-named MCP-B tools when both protocols run', async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb', 'w3c'], mcpServerAfterBridge: true });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'get_price', description: 'w3c wins', execute: () => 'from w3c' })`,
      sandbox,
    );
    const tools = await list(sandbox);
    const price = tools.find(t => t.name === 'get_price');
    expect(price?.source).toBe('w3c');
    expect(tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_price']);
    await expect(call(sandbox, `'get_price', {}`)).resolves.toBe('from w3c');
  });

  it("protocols: ['mcpb'] does not install the navigator.modelContext shim", async () => {
    const sandbox = makeSandbox({ protocols: ['mcpb'], mcpServerAfterBridge: true });
    expect(vm.runInContext('navigator.modelContext', sandbox)).toBeUndefined();
    const tools = await list(sandbox);
    expect(tools.map(t => t.name).sort()).toEqual(['add_to_cart', 'get_price']);
  });

  it("protocols: ['w3c'] never talks to a page MCP server", async () => {
    const sandbox = makeSandbox({ protocols: ['w3c'], mcpServerAfterBridge: true });
    vm.runInContext(
      `navigator.modelContext.registerTool({ name: 'only', description: 'd', execute: () => 1 })`,
      sandbox,
    );
    const tools = await list(sandbox);
    expect(tools.map(t => t.name)).toEqual(['only']);
  });
});
