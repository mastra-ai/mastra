/**
 * WebMCP in-page bridge.
 *
 * Injected via `BrowserContext.addInitScript` so it runs before any page
 * script. It exposes a reader API at `window.__mastraWebMcp` that
 * AgentBrowser drives with `page.evaluate`, backed by two protocol surfaces:
 *
 * - `w3c` — a faithful polyfill of the W3C Web Model Context draft
 *   (`navigator.modelContext.registerTool/unregisterTool`, plus the
 *   earlier-draft `provideContext` for compatibility with pages built
 *   against older revisions or the `@mcp-b/webmcp-polyfill` package, which
 *   polyfills this same API). When the browser ships a native
 *   implementation, registrations are mirrored into it best-effort.
 *
 * - `mcpb` — a real MCP JSON-RPC 2.0 client over the `@mcp-b/transports`
 *   Tab transport: `window.postMessage` envelopes of the shape
 *   `{ channel, type: 'mcp', direction, payload }` on the page's own
 *   window, with the `mcp-check-ready` / `mcp-server-ready` handshake,
 *   then `initialize` → `notifications/initialized` → `tools/list` /
 *   `tools/call`. This is the surface pages get when they run an
 *   `McpServer` connected to a `TabServerTransport`.
 *
 * Because the init script runs at document-start — before any page script
 * can construct a transport — the bridge's message listener always observes
 * the server's `mcp-server-ready` broadcast, so MCP-B detection is passive
 * and adds no polling overhead on pages without a server.
 *
 * The bridge is a raw string, NOT a stringified function: `fn.toString()`
 * breaks whenever a compiler transform touches the function body (e.g.
 * esbuild `keepNames` wraps every function in a `__name(...)` helper that
 * doesn't exist inside the page). A string literal survives any bundler.
 * The vm-based tests in `__tests__/webmcp-bridge.test.ts` execute this
 * exact string, so it stays behaviorally covered.
 *
 * Keep this module side-effect-free at import time — it only exports a
 * builder that returns a string.
 */

import type { WebmcpProtocol } from './types';

/**
 * Body of the bridge init script. Plain ES2017 — runs verbatim in the page.
 * No template literals or `${}` inside: the body itself lives in one.
 *
 * `__MASTRA_WEBMCP_PROTOCOLS__` is replaced at inject time with a JSON array
 * of the enabled protocols.
 */
const BRIDGE_BODY = /* js */ `
  // Re-entrancy: addInitScript fires on every new document in the context,
  // and some SPAs rewrite document.open/close which re-runs scripts.
  if (globalThis.__mastraWebMcp) return;

  var PROTOCOLS = '__MASTRA_WEBMCP_PROTOCOLS__';
  var useW3c = PROTOCOLS.indexOf('w3c') !== -1;
  var useMcpb = PROTOCOLS.indexOf('mcpb') !== -1;

  // ---------------------------------------------------------------------
  // Shared: minimal JSON Schema subset validation (type/required/enum,
  // recursive through properties/items). Unsupported keywords are ignored
  // rather than rejected, so exotic schemas degrade to pass-through.
  // ---------------------------------------------------------------------
  function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function typeMatches(expected, value) {
    var actual = typeOf(value);
    if (expected === 'integer') return actual === 'number' && isFinite(value) && Math.floor(value) === value;
    if (expected === 'number') return actual === 'number';
    return actual === expected;
  }

  function validateAgainstSchema(schema, value, path, problems) {
    if (schema == null || typeof schema !== 'object') return;
    var label = path || 'arguments';

    if (typeof schema.type === 'string' && !typeMatches(schema.type, value)) {
      problems.push(label + ': expected ' + schema.type + ', got ' + typeOf(value));
      return;
    }
    if (Array.isArray(schema.enum) && schema.enum.indexOf(value) === -1) {
      problems.push(label + ': value is not one of the allowed enum values');
      return;
    }
    if (typeOf(value) === 'object') {
      // Use own-property checks (not the "in" operator) so page-declared
      // schemas or agent-supplied args that name inherited keys like
      // "toString" or "constructor" don't bypass required-property
      // enforcement.
      var hasOwn = Object.prototype.hasOwnProperty;
      if (Array.isArray(schema.required)) {
        schema.required.forEach(function (key) {
          if (!hasOwn.call(value, key)) problems.push(label + ': missing required property "' + key + '"');
        });
      }
      if (schema.properties && typeof schema.properties === 'object') {
        Object.keys(schema.properties).forEach(function (key) {
          if (hasOwn.call(value, key)) validateAgainstSchema(schema.properties[key], value[key], label + '.' + key, problems);
        });
      }
    }
    if (typeOf(value) === 'array' && schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
      value.forEach(function (item, i) {
        validateAgainstSchema(schema.items, item, label + '[' + i + ']', problems);
      });
    }
  }

  function validateArgs(schema, args) {
    var problems = [];
    validateAgainstSchema(schema, args === undefined ? {} : args, '', problems);
    return problems;
  }

  function invalidStateError(message) {
    var err = new Error(message);
    err.name = 'InvalidStateError';
    return err;
  }

  // ---------------------------------------------------------------------
  // W3C Web Model Context polyfill (navigator.modelContext).
  // ---------------------------------------------------------------------

  // name -> { description, inputSchema, execute }
  var w3cTools = new Map();
  var native = null;

  function assertValidToolDefinition(def) {
    if (!def || typeof def !== 'object') throw new TypeError('registerTool requires a tool definition object');
    if (typeof def.name !== 'string' || def.name.length === 0) {
      throw invalidStateError('Tool name must be a non-empty string');
    }
    if (typeof def.description !== 'string' || def.description.length === 0) {
      throw invalidStateError('Tool description must be a non-empty string');
    }
    if (def.inputSchema != null) {
      if (typeof def.inputSchema !== 'object' || Array.isArray(def.inputSchema)) {
        throw invalidStateError('Tool inputSchema must be a JSON Schema object');
      }
      if (typeof def.inputSchema.type === 'string' && def.inputSchema.type !== 'object') {
        throw invalidStateError('Tool inputSchema must describe an object');
      }
    }
  }

  function storeW3cTool(def) {
    w3cTools.set(def.name, {
      description: def.description,
      inputSchema: def.inputSchema != null ? def.inputSchema : null,
      execute: typeof def.execute === 'function' ? def.execute : null,
    });
  }

  if (useW3c) {
    var existing = navigator.modelContext;
    if (existing && typeof existing.registerTool === 'function') native = existing;

    var modelContext = {
      registerTool: function (def) {
        assertValidToolDefinition(def);
        if (w3cTools.has(def.name)) {
          throw invalidStateError('A tool named "' + def.name + '" is already registered');
        }
        storeW3cTool(def);
        if (native) {
          try {
            native.registerTool(def);
          } catch (e) {
            // Mirroring is best-effort; our registry already has the tool.
          }
        }
        // Per the current draft IDL, registerTool returns undefined.
      },
      unregisterTool: function (name) {
        if (!w3cTools.has(name)) {
          throw invalidStateError('No tool named "' + name + '" is registered');
        }
        w3cTools.delete(name);
        if (native && typeof native.unregisterTool === 'function') {
          try {
            native.unregisterTool(name);
          } catch (e) {
            // Best-effort mirror.
          }
        }
      },
      // Earlier-draft API (pre-March-2026 revisions and polyfills built on
      // them): replaces the full toolset instead of adding to it.
      provideContext: function (ctx) {
        w3cTools.clear();
        var list = ctx && Array.isArray(ctx.tools) ? ctx.tools : [];
        list.forEach(function (def) {
          try {
            assertValidToolDefinition(def);
            storeW3cTool(def);
          } catch (e) {
            // provideContext was lenient; skip invalid entries.
          }
        });
      },
    };

    try {
      Object.defineProperty(navigator, 'modelContext', {
        configurable: true,
        enumerable: true,
        get: function () {
          return modelContext;
        },
        set: function () {
          // Pages and polyfills may assign navigator.modelContext; their
          // registrations still flow through our registerTool via the getter.
        },
      });
    } catch (e) {
      try {
        navigator.modelContext = modelContext;
      } catch (e2) {
        // Give up silently.
      }
    }
  }

  // ---------------------------------------------------------------------
  // MCP-B: MCP JSON-RPC client over the @mcp-b/transports Tab transport.
  // Wire format (verified against @mcp-b/transports v5.1.0 source):
  //   window.postMessage({ channel, type: 'mcp', direction, payload }, origin)
  //   client->server direction: 'client-to-server'; replies: 'server-to-client'
  //   handshake payloads: 'mcp-check-ready' -> 'mcp-server-ready';
  //   'mcp-server-stopped' on close. All other payloads are JSON-RPC objects.
  // ---------------------------------------------------------------------
  var MCPB_CHANNEL = 'mcp-default';
  var mcpb = {
    serverDetected: false,
    initializing: null,
    pending: new Map(),
    nextId: Math.floor(Math.random() * 0x7fffffff),
    readyWaiters: [],
  };

  function mcpbTargetOrigin() {
    try {
      var origin = window.location.origin;
      if (typeof origin === 'string' && origin.indexOf('http') === 0) return origin;
    } catch (e) {
      // fall through
    }
    return '*';
  }

  function mcpbPost(payload) {
    window.postMessage(
      { channel: MCPB_CHANNEL, type: 'mcp', direction: 'client-to-server', payload: payload },
      mcpbTargetOrigin(),
    );
  }

  function mcpbMarkReady() {
    mcpb.serverDetected = true;
    var waiters = mcpb.readyWaiters;
    mcpb.readyWaiters = [];
    waiters.forEach(function (w) {
      clearTimeout(w.timer);
      w.resolve(true);
    });
  }

  if (useMcpb && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', function (event) {
      if (event.source !== window) return;
      var data = event.data;
      if (
        !data ||
        typeof data !== 'object' ||
        data.channel !== MCPB_CHANNEL ||
        data.type !== 'mcp' ||
        data.direction !== 'server-to-client' ||
        !('payload' in data)
      ) {
        return;
      }
      var payload = data.payload;
      if (payload === 'mcp-server-ready') {
        mcpbMarkReady();
        return;
      }
      if (payload === 'mcp-server-stopped') {
        mcpb.serverDetected = false;
        mcpb.initializing = null;
        mcpb.pending.forEach(function (entry) {
          clearTimeout(entry.timer);
          entry.reject(new Error('The page MCP server stopped'));
        });
        mcpb.pending.clear();
        return;
      }
      if (payload && typeof payload === 'object' && 'id' in payload) {
        var entry = mcpb.pending.get(payload.id);
        if (!entry) return;
        mcpb.pending.delete(payload.id);
        clearTimeout(entry.timer);
        if (payload.error) {
          var message = payload.error && payload.error.message ? payload.error.message : 'MCP request failed';
          entry.reject(new Error(message));
        } else {
          entry.resolve(payload.result);
        }
      }
      // JSON-RPC notifications from the server (e.g. tools/list_changed)
      // need no handling: list() always queries fresh.
    });
  }

  function mcpbRequest(method, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = mcpb.nextId++;
      var timer = setTimeout(function () {
        mcpb.pending.delete(id);
        reject(new Error('Timed out waiting for the page MCP server to respond to ' + method));
      }, timeoutMs);
      mcpb.pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      mcpbPost({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    });
  }

  function mcpbEnsureServer(graceMs) {
    if (!useMcpb) return Promise.resolve(false);
    if (mcpb.serverDetected) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var waiter = { resolve: resolve, timer: null };
      waiter.timer = setTimeout(function () {
        var idx = mcpb.readyWaiters.indexOf(waiter);
        if (idx !== -1) mcpb.readyWaiters.splice(idx, 1);
        resolve(false);
      }, graceMs);
      mcpb.readyWaiters.push(waiter);
      mcpbPost('mcp-check-ready');
    });
  }

  function mcpbEnsureInitialized() {
    if (!mcpb.initializing) {
      mcpb.initializing = mcpbRequest(
        'initialize',
        {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'mastra-agent-browser', version: '0.0.0' },
        },
        5000,
      ).then(function (result) {
        mcpbPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
        return result;
      });
      mcpb.initializing.catch(function () {
        // Allow a retry on the next list/call instead of caching the failure.
        mcpb.initializing = null;
      });
    }
    return mcpb.initializing;
  }

  function mcpbListTools() {
    return mcpbEnsureServer(300).then(function (available) {
      if (!available) return [];
      return mcpbEnsureInitialized()
        .then(function () {
          return mcpbRequest('tools/list', {}, 5000);
        })
        .then(function (result) {
          var list = result && Array.isArray(result.tools) ? result.tools : [];
          return list
            .filter(function (t) {
              return t && typeof t.name === 'string';
            })
            .map(function (t) {
              return {
                name: t.name,
                description: typeof t.description === 'string' ? t.description : null,
                inputSchema: t.inputSchema != null ? t.inputSchema : null,
              };
            });
        });
    });
  }

  function normalizeMcpResult(result) {
    if (result && typeof result === 'object') {
      if (result.isError) {
        var text = '';
        if (Array.isArray(result.content)) {
          result.content.forEach(function (part) {
            if (part && part.type === 'text' && typeof part.text === 'string') text += part.text;
          });
        }
        throw new Error(text || 'The page MCP tool reported an error');
      }
      if (result.structuredContent !== undefined) return result.structuredContent;
      if (Array.isArray(result.content)) {
        if (result.content.length === 1 && result.content[0] && result.content[0].type === 'text') {
          var raw = result.content[0].text;
          try {
            return JSON.parse(raw);
          } catch (e) {
            return raw;
          }
        }
        return result.content;
      }
    }
    return result;
  }

  function mcpbCallTool(name, args) {
    return mcpbEnsureServer(300).then(function (available) {
      if (!available) {
        throw new Error('WebMCP tool "' + name + '" is not registered on this page');
      }
      return mcpbEnsureInitialized()
        .then(function () {
          return mcpbRequest('tools/call', { name: name, arguments: args === undefined ? {} : args }, 30000);
        })
        .then(normalizeMcpResult);
    });
  }

  // ---------------------------------------------------------------------
  // Reader API consumed by AgentBrowser via page.evaluate. Both methods
  // return promises; Playwright awaits them automatically.
  // ---------------------------------------------------------------------
  globalThis.__mastraWebMcp = {
    list: function () {
      var out = [];
      if (useW3c) {
        w3cTools.forEach(function (entry, name) {
          out.push({ name: name, source: 'w3c', description: entry.description, inputSchema: entry.inputSchema });
        });
      }
      if (!useMcpb) return Promise.resolve(out);
      return mcpbListTools().then(function (serverTools) {
        serverTools.forEach(function (t) {
          // W3C registrations win when a page exposes both under one name.
          if (useW3c && w3cTools.has(t.name)) return;
          out.push({ name: t.name, source: 'mcpb', description: t.description, inputSchema: t.inputSchema });
        });
        return out;
      });
    },
    call: function (name, args) {
      if (useW3c && w3cTools.has(name)) {
        var entry = w3cTools.get(name);
        if (!entry.execute) {
          return Promise.reject(new Error('WebMCP tool "' + name + '" has no callable execute function'));
        }
        var problems = validateArgs(entry.inputSchema, args);
        if (problems.length > 0) {
          return Promise.reject(
            new Error('Arguments for WebMCP tool "' + name + '" do not match its inputSchema: ' + problems.join('; ')),
          );
        }
        return Promise.resolve().then(function () {
          return entry.execute(args === undefined ? {} : args);
        });
      }
      if (useMcpb) return mcpbCallTool(name, args);
      return Promise.reject(new Error('WebMCP tool "' + name + '" is not registered on this page'));
    },
  };
`;

/**
 * Build an init script that installs the WebMCP bridge for the chosen protocols.
 */
export function buildWebMcpInitScript(protocols: readonly WebmcpProtocol[]): string {
  const body = BRIDGE_BODY.replace("'__MASTRA_WEBMCP_PROTOCOLS__'", JSON.stringify(protocols));
  return `(function () {\n${body}\n})();`;
}
