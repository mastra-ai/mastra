import { AppRenderer } from '@mcp-ui/client';
import type { AppRendererHandle, SandboxConfig } from '@mcp-ui/client';
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useMemo, useRef, useState } from 'react';

const SANDBOX_PROXY_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;width:100%;height:100%}</style></head>
<body><script>
window.addEventListener('message',function(e){
  var d=e.data;if(!d||typeof d!=='object')return;
  if(d.method==='ui/notifications/sandbox-resource-ready'){
    var h=(d.params||{}).html;if(h){document.open();document.write(h);document.close()}
  }
});
window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-proxy-ready',params:{}},'*');
<\/script></body></html>`;

let _blobUrl: URL | null = null;
function getSandboxBlobUrl(): URL {
  if (!_blobUrl) {
    const blob = new Blob([SANDBOX_PROXY_HTML], { type: 'text/html' });
    _blobUrl = new URL(URL.createObjectURL(blob));
  }
  return _blobUrl;
}

export interface McpAppViewerProps {
  /** The HTML content to render in the sandboxed iframe */
  html: string;
  /** Title for the iframe (accessibility) */
  title?: string;
  /** Name of the MCP tool this UI is associated with */
  toolName?: string;
  /** Tool arguments that triggered this UI (delivered via tool-input notification) */
  toolInput?: Record<string, unknown>;
  /** Tool execution result (delivered via tool-result notification) */
  toolResult?: unknown;
  /** Callback when the app sends a tool call request via callServerTool */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Callback when the app sends a message via sendMessage (drives new chat turns) */
  onSendMessage?: (content: string) => void;
  /** Sandbox configuration — URL to the sandbox proxy HTML. If omitted, a blob URL is generated automatically. */
  sandboxUrl?: URL;
  /** Optional className for the container */
  className?: string;
}

/**
 * McpAppViewer renders MCP App HTML using the standard @mcp-ui/client AppRenderer.
 *
 * This component wraps AppRenderer to provide a Mastra-specific API while delegating
 * all MCP Apps protocol handling (bridge injection, handshake, tool input/result
 * delivery, JSON-RPC communication) to the standard implementation.
 */
export function McpAppViewer({
  html,
  title: _title = 'MCP App',
  toolName = 'mcp-app',
  toolInput,
  toolResult,
  onToolCall,
  onSendMessage,
  sandboxUrl,
  className,
}: McpAppViewerProps) {
  const appRef = useRef<AppRendererHandle>(null);
  const [height, setHeight] = useState(400);

  // hostInfo MUST be memoized — it is a dependency of the bridge creation effect
  // in AppRenderer. A new object reference triggers bridge recreation → sandbox
  // timeout → toolInput never delivered.
  const hostInfo = useMemo(() => ({ name: 'Mastra Studio', version: '1.0.0' }), []);

  const normalizedToolResult: CallToolResult | undefined = useMemo(() => {
    if (toolResult === undefined) return undefined;
    if (toolResult && typeof toolResult === 'object' && Array.isArray((toolResult as CallToolResult).content)) {
      return toolResult as CallToolResult;
    }
    return {
      content: [
        { type: 'text' as const, text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) },
      ],
    };
  }, [toolResult]);

  const resolvedSandboxUrl = useMemo(() => sandboxUrl ?? getSandboxBlobUrl(), [sandboxUrl]);
  const sandbox: SandboxConfig = useMemo(() => ({ url: resolvedSandboxUrl }), [resolvedSandboxUrl]);

  const handleCallTool = useCallback(
    async (params: CallToolRequest['params']): Promise<CallToolResult> => {
      if (!onToolCall) {
        return { content: [{ type: 'text', text: 'Tool calls not supported' }] };
      }
      const raw = await onToolCall(params.name, (params.arguments ?? {}) as Record<string, unknown>);

      // Detect if the result is already a CallToolResult (has content array with typed items)
      // or wrapped in an API envelope { result: CallToolResult }
      const isCtResult = (obj: unknown): boolean =>
        !!obj &&
        typeof obj === 'object' &&
        Array.isArray((obj as Record<string, unknown>).content) &&
        ((obj as Record<string, unknown>).content as unknown[]).length > 0 &&
        typeof ((obj as Record<string, unknown>).content as Record<string, unknown>[])[0]?.type === 'string';

      if (raw && typeof raw === 'object' && 'result' in raw && isCtResult((raw as Record<string, unknown>).result)) {
        return (raw as { result: CallToolResult }).result;
      }
      if (isCtResult(raw)) {
        return raw as CallToolResult;
      }
      return {
        content: [{ type: 'text', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }],
        structuredContent: typeof raw === 'object' ? (raw as Record<string, unknown>) : { result: raw },
      };
    },
    [onToolCall],
  );

  const handleMessage = useCallback(
    async (params: { role: string; content: Array<{ type: string; text?: string }> }) => {
      if (!onSendMessage) return {};
      const text = params.content
        ?.filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      if (text) {
        onSendMessage(text);
      }
      return {};
    },
    [onSendMessage],
  );

  const handleOpenLink = useCallback(async (params: { url: string }) => {
    if (typeof params.url === 'string') {
      window.open(params.url, '_blank', 'noopener,noreferrer');
    }
    return {};
  }, []);

  const handleSizeChanged = useCallback((params: { width?: number; height?: number }) => {
    if (typeof params.height === 'number') {
      setHeight(Math.max(100, Math.min(params.height, 2000)));
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[McpAppViewer]', error);
  }, []);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        borderRadius: '8px',
        background: 'white',
      }}
    >
      <AppRenderer
        ref={appRef}
        toolName={toolName}
        sandbox={sandbox}
        html={html}
        toolInput={toolInput}
        toolResult={normalizedToolResult}
        hostInfo={hostInfo}
        onCallTool={handleCallTool}
        onMessage={handleMessage}
        onOpenLink={handleOpenLink}
        onSizeChanged={handleSizeChanged}
        onError={handleError}
      />
    </div>
  );
}
