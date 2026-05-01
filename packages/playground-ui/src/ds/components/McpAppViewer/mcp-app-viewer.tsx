import { useCallback, useEffect, useRef, useState } from 'react';

export interface McpAppViewerProps {
  /** The HTML content to render in the sandboxed iframe */
  html: string;
  /** Title for the iframe (accessibility) */
  title?: string;
  /** Tool arguments that triggered this UI (delivered via tool-input notification) */
  toolInput?: Record<string, unknown>;
  /** Tool execution result (delivered via tool-result notification) */
  toolResult?: unknown;
  /** Callback when the app sends a tool call request via callServerTool */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Callback when the app sends a message via sendMessage (drives new chat turns) */
  onSendMessage?: (content: string) => void;
  /** Optional className for the container */
  className?: string;
}

const SANDBOX_ATTRS = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';

/**
 * McpAppViewer renders MCP App HTML in a sandboxed iframe with MCP Apps protocol support.
 *
 * Implements the key parts of the MCP Apps postMessage protocol:
 * - ui/initialize handshake
 * - ui/notifications/tool-input and tool-result data delivery
 * - tools/call proxying (app → host → MCP server)
 * - ui/message for injecting follow-up messages into the chat
 * - ui/update-model-context for silent context updates
 * - Resize observation for dynamic height
 */
export function McpAppViewer({
  html,
  title = 'MCP App',
  toolInput,
  toolResult,
  onToolCall,
  onSendMessage,
  className,
}: McpAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);
  const initializedRef = useRef(false);

  const postToIframe = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  // Send tool-input and tool-result once the app signals initialized
  const deliverData = useCallback(() => {
    if (toolInput !== undefined) {
      postToIframe({
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-input',
        params: { arguments: toolInput },
      });
    }
    if (toolResult !== undefined) {
      postToIframe({
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: {
          content: [{ type: 'text', text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) }],
          structuredContent: typeof toolResult === 'object' ? toolResult : { result: toolResult },
        },
      });
    }
  }, [toolInput, toolResult, postToIframe]);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!iframeRef.current) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // --- JSON-RPC protocol messages ---
      if (data.jsonrpc === '2.0') {
        const method = data.method as string;

        // ui/initialize — respond with host context and capabilities
        if (method === 'ui/initialize') {
          postToIframe({
            jsonrpc: '2.0',
            id: data.id,
            result: {
              protocolVersion: '0.1.0',
              hostInfo: { name: 'Mastra Studio', version: '1.0.0' },
              hostContext: { theme: 'light' },
              capabilities: {
                serverTools: {},
                messages: {},
                openLinks: {},
                logging: {},
              },
            },
          });
          return;
        }

        // ui/notifications/initialized — app is ready, deliver data
        if (method === 'ui/notifications/initialized') {
          initializedRef.current = true;
          deliverData();
          return;
        }

        // tools/call — proxy tool calls to MCP server
        if (method === 'tools/call' && onToolCall) {
          const { name, arguments: args } = data.params ?? {};
          try {
            const raw = await onToolCall(name, args ?? {});

            // Detect if the result is already a CallToolResult (has content array with typed items)
            // or wrapped in an API envelope { result: CallToolResult }
            const isCtResult = (obj: unknown): boolean =>
              !!obj &&
              typeof obj === 'object' &&
              Array.isArray((obj as Record<string, unknown>).content) &&
              ((obj as Record<string, unknown>).content as unknown[]).length > 0 &&
              typeof ((obj as Record<string, unknown>).content as Record<string, unknown>[])[0]?.type === 'string';

            let callToolResult;
            if (
              raw &&
              typeof raw === 'object' &&
              'result' in raw &&
              isCtResult((raw as Record<string, unknown>).result)
            ) {
              // API envelope: { result: CallToolResult }
              callToolResult = (raw as Record<string, unknown>).result;
            } else if (isCtResult(raw)) {
              // Already a CallToolResult
              callToolResult = raw;
            } else {
              // Simple value — wrap it
              callToolResult = {
                content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
                structuredContent: typeof raw === 'object' ? raw : { result: raw },
              };
            }

            postToIframe({
              jsonrpc: '2.0',
              id: data.id,
              result: callToolResult,
            });
          } catch (err) {
            postToIframe({
              jsonrpc: '2.0',
              id: data.id,
              error: {
                code: -32000,
                message: err instanceof Error ? err.message : String(err),
              },
            });
          }
          return;
        }

        // ui/message — inject a message into the chat
        if (method === 'ui/message' && onSendMessage) {
          const content = data.params?.content;
          if (Array.isArray(content)) {
            const text = content
              .filter((block: { type: string }) => block.type === 'text')
              .map((block: { text: string }) => block.text)
              .join('\n');
            if (text) {
              onSendMessage(text);
            }
          }
          // Acknowledge
          postToIframe({ jsonrpc: '2.0', id: data.id, result: {} });
          return;
        }

        // ui/update-model-context — acknowledge silently
        if (method === 'ui/update-model-context') {
          postToIframe({ jsonrpc: '2.0', id: data.id, result: {} });
          return;
        }

        // ui/open-link — open in new tab
        if (method === 'ui/open-link') {
          const url = data.params?.url;
          if (typeof url === 'string') {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          postToIframe({ jsonrpc: '2.0', id: data.id, result: {} });
          return;
        }

        // ui/notifications/size-changed — resize
        if (method === 'ui/notifications/size-changed' || method === 'ui/size-change') {
          const h = data.params?.height;
          if (typeof h === 'number') {
            setHeight(Math.max(100, Math.min(h, 2000)));
          }
          return;
        }

        return;
      }

      // --- Legacy custom protocol (backward compat) ---

      // Handle size changes
      if (data.type === 'mcp-app:resize') {
        const newHeight = typeof data.height === 'number' ? data.height : 400;
        setHeight(Math.max(100, Math.min(newHeight, 2000)));
        return;
      }

      // Handle legacy tool call requests
      if (data.type === 'mcp-app:tool-call' && onToolCall) {
        const { id, toolName, args } = data;
        try {
          const result = await onToolCall(toolName, args ?? {});
          iframeRef.current.contentWindow?.postMessage({ type: 'mcp-app:tool-result', id, result }, '*');
        } catch (err) {
          iframeRef.current.contentWindow?.postMessage(
            {
              type: 'mcp-app:tool-result',
              id,
              error: err instanceof Error ? err.message : String(err),
            },
            '*',
          );
        }
      }

      // Handle legacy sendMessage
      if (data.type === 'mcp-app:send-message' && onSendMessage) {
        if (typeof data.text === 'string') {
          onSendMessage(data.text);
        }
      }
    },
    [onToolCall, onSendMessage, postToIframe, deliverData],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Inject bridge script that implements both the MCP Apps JSON-RPC protocol
  // and the legacy custom protocol for backward compatibility
  const bridgeScript = `
<script>
(function() {
  // --- Resize observation ---
  var resizeObserver = new ResizeObserver(function() {
    var height = document.documentElement.scrollHeight;
    parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/notifications/size-changed',
      params: { height: height }
    }, '*');
  });
  resizeObserver.observe(document.documentElement);

  // --- JSON-RPC request/response tracking ---
  var pendingCalls = {};
  var rpcId = 0;

  function rpcRequest(method, params) {
    return new Promise(function(resolve, reject) {
      var id = ++rpcId;
      pendingCalls[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ jsonrpc: '2.0', id: id, method: method, params: params }, '*');
    });
  }

  // --- MCP Apps API (window.__mcpApp) ---
  // Follows the MCP Apps spec: callServerTool, sendMessage, updateModelContext
  var toolInputData = null;
  var toolResultData = null;
  var onToolInputCallback = null;
  var onToolResultCallback = null;
  var onTeardownCallback = null;

  window.__mcpApp = {
    // Call a tool on the originating MCP server
    callServerTool: function(params) {
      return rpcRequest('tools/call', { name: params.name, arguments: params.arguments || {} });
    },
    // Send a message to the chat (triggers new model turn)
    sendMessage: function(params) {
      return rpcRequest('ui/message', params);
    },
    // Update model context silently (no immediate response)
    updateModelContext: function(params) {
      return rpcRequest('ui/update-model-context', params);
    },
    // Open an external link
    openLink: function(url) {
      return rpcRequest('ui/open-link', { url: url });
    },
    // Get the current tool input
    get toolInput() { return toolInputData; },
    // Get the current tool result
    get toolResult() { return toolResultData; },
    // Set callbacks
    set ontoolinput(fn) { onToolInputCallback = fn; },
    set ontoolresult(fn) { onToolResultCallback = fn; },
    set onteardown(fn) { onTeardownCallback = fn; },
  };

  // --- Legacy bridge (backward compat) ---
  window.__mcpBridge = {
    callTool: function(toolName, args) {
      return rpcRequest('tools/call', { name: toolName, arguments: args || {} })
        .then(function(r) { return r && r.structuredContent ? r.structuredContent : r; });
    },
    sendMessage: function(text) {
      parent.postMessage({ type: 'mcp-app:send-message', text: text }, '*');
    }
  };

  // --- Message handler ---
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    // JSON-RPC responses (for pending requests)
    if (data.jsonrpc === '2.0' && data.id && (data.result !== undefined || data.error)) {
      var pending = pendingCalls[data.id];
      if (pending) {
        delete pendingCalls[data.id];
        if (data.error) {
          pending.reject(new Error(data.error.message || JSON.stringify(data.error)));
        } else {
          pending.resolve(data.result);
        }
      }
      return;
    }

    // JSON-RPC notifications from host
    if (data.jsonrpc === '2.0' && data.method) {
      if (data.method === 'ui/notifications/tool-input') {
        toolInputData = data.params && data.params.arguments;
        if (onToolInputCallback) onToolInputCallback(toolInputData);
      }
      if (data.method === 'ui/notifications/tool-result') {
        toolResultData = data.params;
        if (onToolResultCallback) onToolResultCallback(toolResultData);
      }
      if (data.method === 'ui/resource-teardown') {
        if (onTeardownCallback) {
          Promise.resolve(onTeardownCallback()).then(function() {
            parent.postMessage({ jsonrpc: '2.0', id: data.id, result: {} }, '*');
          });
        } else {
          parent.postMessage({ jsonrpc: '2.0', id: data.id, result: {} }, '*');
        }
      }
      return;
    }

    // Legacy tool-result responses
    if (data.type === 'mcp-app:tool-result') {
      var legacyPending = pendingCalls[data.id];
      if (legacyPending) {
        delete pendingCalls[data.id];
        if (data.error) {
          legacyPending.reject(new Error(data.error));
        } else {
          legacyPending.resolve(data.result);
        }
      }
    }
  });

  // --- Initialize handshake ---
  rpcRequest('ui/initialize', {
    appInfo: { name: 'MCP App', version: '1.0.0' },
    capabilities: {}
  }).then(function(result) {
    // Signal we're ready
    parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/notifications/initialized',
      params: {}
    }, '*');
  });

  // Initial size report
  setTimeout(function() {
    parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/notifications/size-changed',
      params: { height: document.documentElement.scrollHeight }
    }, '*');
  }, 100);
})();
</script>`;

  // Insert bridge script before closing </body> or at end of HTML
  const enhancedHtml = html.includes('</body>')
    ? html.replace('</body>', `${bridgeScript}</body>`)
    : html + bridgeScript;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={enhancedHtml}
      title={title}
      sandbox={SANDBOX_ATTRS}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        borderRadius: '8px',
        background: 'white',
      }}
    />
  );
}
