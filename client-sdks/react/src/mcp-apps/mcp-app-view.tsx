import { AppRenderer } from '@mcp-ui/client';
import type { AppRendererProps, SandboxConfig } from '@mcp-ui/client';
import { useCallback, useMemo, useState } from 'react';
import type { GenUIMcpAppViewProps } from '../gen-ui/mcp-apps';

type CallToolHandler = NonNullable<AppRendererProps['onCallTool']>;
type MessageHandler = NonNullable<AppRendererProps['onMessage']>;
type FallbackRequestHandler = NonNullable<AppRendererProps['onFallbackRequest']>;
type OpenLinkHandler = NonNullable<AppRendererProps['onOpenLink']>;
type SizeChangedHandler = NonNullable<AppRendererProps['onSizeChanged']>;
type CallToolResult = Awaited<ReturnType<CallToolHandler>>;

// JSON-RPC error codes; the bridge reports a thrown error's numeric `code` to the app.
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

const rpcError = (code: number, message: string) => Object.assign(new Error(message), { code });

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

let sandboxBlobUrl: URL | undefined;
function defaultSandboxUrl(): URL {
  sandboxBlobUrl ??= new URL(URL.createObjectURL(new Blob([SANDBOX_PROXY_HTML], { type: 'text/html' })));
  return sandboxBlobUrl;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isCallToolResult = (value: unknown): value is CallToolResult =>
  isRecord(value) &&
  Array.isArray(value.content) &&
  value.content.every(block => isRecord(block) && typeof block.type === 'string');

/** Wraps a plain tool output the way MCP tools report it: JSON text for the model, structured content for apps. */
function toCallToolResult(output: unknown): CallToolResult {
  if (isCallToolResult(output)) return output;
  return {
    content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }],
    ...(isRecord(output) && { structuredContent: output }),
  };
}

/** The app's model context as text, labelled with the app it comes from. Empty context clears it. */
function modelContextText(toolName: string, params: Record<string, unknown> | undefined): string | undefined {
  const content: unknown[] = Array.isArray(params?.content) ? params.content : [];
  const text = content.flatMap(block =>
    isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
  );
  if (params?.structuredContent !== undefined) text.push(JSON.stringify(params.structuredContent));
  if (text.length === 0) return undefined;
  return [`Context from the "${toolName}" MCP App shown in this conversation:`, ...text].join('\n');
}

export interface McpAppViewProps extends GenUIMcpAppViewProps {
  /** Extra host-context keys sent to the app, such as `theme`. Changes reach the running app. */
  hostContext?: AppRendererProps['hostContext'];
  /** URL of the sandbox proxy page the app loads in. Defaults to a generated blob URL. */
  sandboxUrl?: URL;
  className?: string;
}

/**
 * Hosts an MCP App in a sandboxed iframe through `@mcp-ui/client`'s `AppRenderer`: hands it the
 * tool input and result, and routes its tool calls, messages, model context, and links.
 */
export function McpAppView({
  html,
  toolName,
  toolInput,
  toolResult,
  onToolCall,
  onSendMessage,
  onUpdateModelContext,
  hostContext,
  sandboxUrl,
  className,
}: McpAppViewProps) {
  const [height, setHeight] = useState(400);

  // The bridge is rebuilt whenever hostInfo, hostCapabilities, or sandbox change identity, which
  // drops the connection to the running app, so all three are kept stable.
  const hostInfo = useMemo(() => ({ name: 'Mastra', version: '1.0.0' }), []);
  const hostCapabilities = useMemo(
    () => ({ openLinks: {}, serverTools: {}, message: {}, updateModelContext: { text: {}, structuredContent: {} } }),
    [],
  );
  const sandbox: SandboxConfig = useMemo(() => ({ url: sandboxUrl ?? defaultSandboxUrl() }), [sandboxUrl]);
  const result = useMemo(() => (toolResult === undefined ? undefined : toCallToolResult(toolResult)), [toolResult]);

  const handleCallTool = useCallback<CallToolHandler>(
    async params => toCallToolResult(await onToolCall(params.name, params.arguments ?? {})),
    [onToolCall],
  );

  const handleMessage = useCallback<MessageHandler>(
    async params => {
      const text = params.content
        .flatMap(block => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim();
      if (!text) return {};
      try {
        await onSendMessage(text);
        return {};
      } catch {
        return { isError: true };
      }
    },
    [onSendMessage],
  );

  // AppRenderer has no prop for ui/update-model-context, so it arrives as an unhandled request.
  const handleFallbackRequest = useCallback<FallbackRequestHandler>(
    async request => {
      if (request.method !== 'ui/update-model-context') {
        throw rpcError(METHOD_NOT_FOUND, `No handler for method: ${request.method}`);
      }
      onUpdateModelContext(modelContextText(toolName, request.params));
      return {};
    },
    [onUpdateModelContext, toolName],
  );

  const handleOpenLink = useCallback<OpenLinkHandler>(async params => {
    const protocol = URL.canParse(params.url) ? new URL(params.url).protocol : undefined;
    // Anything else (javascript:, data:, file:, ...) would run code or read local files, not open a page.
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw rpcError(INVALID_PARAMS, 'Only http and https links can be opened from an MCP App');
    }
    window.open(params.url, '_blank', 'noopener,noreferrer');
    return {};
  }, []);

  const handleSizeChanged = useCallback<SizeChangedHandler>(params => {
    if (typeof params.height === 'number') setHeight(Math.max(100, Math.min(params.height, 2000)));
  }, []);

  return (
    <div
      className={className}
      data-mcp-app={toolName}
      style={{ width: '100%', height: `${height}px`, overflow: 'hidden', borderRadius: '8px' }}
    >
      <AppRenderer
        toolName={toolName}
        sandbox={sandbox}
        html={html}
        toolInput={toolInput}
        toolResult={result}
        hostInfo={hostInfo}
        hostCapabilities={hostCapabilities}
        hostContext={hostContext}
        onCallTool={handleCallTool}
        onMessage={handleMessage}
        onFallbackRequest={handleFallbackRequest}
        onOpenLink={handleOpenLink}
        onSizeChanged={handleSizeChanged}
      />
    </div>
  );
}
