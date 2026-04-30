import { useCallback, useEffect, useRef, useState } from 'react';

export interface McpAppViewerProps {
  /** The HTML content to render in the sandboxed iframe */
  html: string;
  /** Title for the iframe (accessibility) */
  title?: string;
  /** Callback when the app sends a tool call request */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Optional className for the container */
  className?: string;
}

const SANDBOX_ATTRS = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';

/**
 * McpAppViewer renders MCP App HTML content in a sandboxed iframe.
 *
 * It uses a srcdoc-based iframe with restricted sandbox permissions and
 * communicates with the app via postMessage for tool calls.
 *
 * The iframe injects a minimal bridge script that:
 * 1. Listens for JSON-RPC tool call requests from the app
 * 2. Proxies them to the host via postMessage
 * 3. Returns the result back to the app
 */
export function McpAppViewer({ html, title = 'MCP App', onToolCall, className }: McpAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!iframeRef.current) return;
      // Only accept messages from our iframe
      if (event.source !== iframeRef.current.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handle size changes from the app
      if (data.type === 'mcp-app:resize') {
        const newHeight = typeof data.height === 'number' ? data.height : 400;
        setHeight(Math.max(100, Math.min(newHeight, 2000)));
        return;
      }

      // Handle tool call requests (JSON-RPC style)
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
    },
    [onToolCall],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Inject a bridge script into the HTML that sets up postMessage communication
  const bridgeScript = `
<script>
(function() {
  // Notify host of content size
  var resizeObserver = new ResizeObserver(function(entries) {
    var height = document.documentElement.scrollHeight;
    parent.postMessage({ type: 'mcp-app:resize', height: height }, '*');
  });
  resizeObserver.observe(document.documentElement);

  // Set up tool call bridge
  var pendingCalls = {};
  var callId = 0;

  window.__mcpBridge = {
    callTool: function(toolName, args) {
      return new Promise(function(resolve, reject) {
        var id = ++callId;
        pendingCalls[id] = { resolve: resolve, reject: reject };
        parent.postMessage({ type: 'mcp-app:tool-call', id: id, toolName: toolName, args: args }, '*');
      });
    }
  };

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.type !== 'mcp-app:tool-result') return;
    var pending = pendingCalls[data.id];
    if (!pending) return;
    delete pendingCalls[data.id];
    if (data.error) {
      pending.reject(new Error(data.error));
    } else {
      pending.resolve(data.result);
    }
  });

  // Initial size report
  setTimeout(function() {
    parent.postMessage({ type: 'mcp-app:resize', height: document.documentElement.scrollHeight }, '*');
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
