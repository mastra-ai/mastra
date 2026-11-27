import { AppRenderer } from '@mcp-ui/client';
import type { AppRendererHandle, SandboxConfig } from '@mcp-ui/client';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest, CallToolResult, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import type { McpAppModelContextParams } from '../context/mcp-app-host-context-value';
import { installMcpAppSandboxLock, sandboxAttributeForProxy, sandboxProxyHtml } from './mcp-app-sandbox';
import { useTheme } from '@/ds/components/ThemeProvider';

type HostCapabilities = NonNullable<ComponentProps<typeof AppRenderer>['hostCapabilities']>;

let _blobUrl: URL | null = null;
let _blobOrigin: string | null = null;
function getSandboxBlobUrl(): URL {
  const origin = window.location.origin;
  if (!_blobUrl || _blobOrigin !== origin) {
    // Opaque to Studio: the proxy document does not inherit this page's origin.
    const blob = new Blob([sandboxProxyHtml(origin)], { type: 'text/html' });
    _blobUrl = new URL(URL.createObjectURL(blob));
    _blobOrigin = origin;
  }
  return _blobUrl;
}

/** Renders an app's model context as text, labelled with the app it comes from. Empty context clears it. */
function modelContextText(toolName: string, params: JSONRPCRequest['params']): string | undefined {
  const text = Array.isArray(params?.content)
    ? params.content
        .filter(
          (block): block is { type: 'text'; text: string } => block?.type === 'text' && typeof block.text === 'string',
        )
        .map(block => block.text)
    : [];
  if (params?.structuredContent !== undefined) {
    text.push(JSON.stringify(params.structuredContent));
  }
  if (text.length === 0) return undefined;
  return [`Context from the "${toolName}" MCP App shown in this conversation:`, ...text].join('\n');
}

function modelContextParams(params: JSONRPCRequest['params']): McpAppModelContextParams {
  const { content, structuredContent } = params ?? {};
  const isRecord =
    structuredContent !== null && typeof structuredContent === 'object' && !Array.isArray(structuredContent);
  return {
    ...(Array.isArray(content) && { content }),
    ...(isRecord && { structuredContent: structuredContent as Record<string, unknown> }),
  };
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
  /** Callback when the app sends a tool call request via callServerTool. Resolves with the tool's output. */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Callback when the app sends a message via sendMessage (drives new chat turns) */
  onSendMessage?: (content: string) => void;
  /**
   * Callback when the app updates its model context via updateModelContext. Receives the context as
   * text for the agent's next turn, or `undefined` when the app clears it.
   */
  onUpdateModelContext?: (context: string | undefined) => void;
  /** Callback with the raw params of each updateModelContext, alongside `onUpdateModelContext`. */
  onModelContext?: (params: McpAppModelContextParams) => void;
  /** Extra host-context keys sent to the app; `theme` stays the viewer's own. Changes reach the running app. */
  hostContext?: Record<string, unknown>;
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
  onUpdateModelContext,
  onModelContext,
  hostContext: extraHostContext,
  sandboxUrl,
  className,
}: McpAppViewerProps) {
  // Only while this viewer is mounted, and only for iframes that set a sandbox attribute.
  // @mcp-ui/client 7.1.1 sets that attribute with setAttribute before assigning src.
  useLayoutEffect(() => installMcpAppSandboxLock(), []);
  const appRef = useRef<AppRendererHandle>(null);
  const [height, setHeight] = useState(400);

  // hostInfo MUST be memoized — it is a dependency of the bridge creation effect
  // in AppRenderer. A new object reference triggers bridge recreation → sandbox
  // timeout → toolInput never delivered.
  const hostInfo = useMemo(() => ({ name: 'Mastra Studio', version: '1.0.0' }), []);
  // Advertise only what this viewer handles; apps feature-detect these before calling.
  // Memoized for the same reason as hostInfo.
  const canCallTools = Boolean(onToolCall);
  const canSendMessages = Boolean(onSendMessage);
  const canUpdateModelContext = Boolean(onUpdateModelContext || onModelContext);
  const hostCapabilities: HostCapabilities = useMemo(
    () => ({
      openLinks: {},
      ...(canCallTools && { serverTools: {} }),
      ...(canSendMessages && { message: {} }),
      ...(canUpdateModelContext && { updateModelContext: { text: {}, structuredContent: {} } }),
    }),
    [canCallTools, canSendMessages, canUpdateModelContext],
  );
  const { resolvedTheme } = useTheme();
  // Not a bridge dependency: AppRenderer sends only the keys that changed, to the running app.
  const hostContext = useMemo(() => ({ ...extraHostContext, theme: resolvedTheme }), [extraHostContext, resolvedTheme]);

  const normalizedToolResult: CallToolResult | undefined = useMemo(() => {
    if (toolResult === undefined) return undefined;
    if (toolResult && typeof toolResult === 'object' && Array.isArray((toolResult as CallToolResult).content)) {
      return toolResult as CallToolResult;
    }
    const text = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
    // Apps render from structuredContent; the JSON text is the model-facing channel the spec asks to mirror it in.
    const isRecord = toolResult !== null && typeof toolResult === 'object' && !Array.isArray(toolResult);
    return {
      content: [{ type: 'text' as const, text }],
      ...(isRecord && { structuredContent: toolResult as Record<string, unknown> }),
    };
  }, [toolResult]);

  const resolvedSandboxUrl = useMemo(() => sandboxUrl ?? getSandboxBlobUrl(), [sandboxUrl]);
  // `@mcp-ui/client` currently ignores `permissions` and hardcodes allow-same-origin.
  // `installMcpAppSandboxLock` applies this value before the frame navigates.
  const sandbox: SandboxConfig = useMemo(
    () => ({
      url: resolvedSandboxUrl,
      permissions: sandboxAttributeForProxy(
        'allow-scripts allow-forms',
        resolvedSandboxUrl.href,
        typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
      ),
    }),
    [resolvedSandboxUrl],
  );

  const handleCallTool = useCallback(
    async (params: CallToolRequest['params']): Promise<CallToolResult> => {
      if (!onToolCall) {
        return { content: [{ type: 'text', text: 'Tool calls not supported' }] };
      }
      const raw = await onToolCall(params.name, params.arguments ?? {});

      // Detect if the result is already a CallToolResult (has content array with typed items)
      const isCtResult = (obj: unknown): boolean =>
        !!obj &&
        typeof obj === 'object' &&
        Array.isArray((obj as Record<string, unknown>).content) &&
        ((obj as Record<string, unknown>).content as unknown[]).length > 0 &&
        typeof ((obj as Record<string, unknown>).content as Record<string, unknown>[])[0]?.type === 'string';

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

  // AppRenderer has no prop for ui/update-model-context, so it arrives as an unhandled request.
  const handleFallbackRequest = useCallback(
    async (request: JSONRPCRequest) => {
      if (request.method !== 'ui/update-model-context' || !canUpdateModelContext) {
        throw new McpError(ErrorCode.MethodNotFound, `No handler for method: ${request.method}`);
      }
      onUpdateModelContext?.(modelContextText(toolName, request.params));
      onModelContext?.(modelContextParams(request.params));
      return {};
    },
    [canUpdateModelContext, onUpdateModelContext, onModelContext, toolName],
  );

  const handleOpenLink = useCallback(async (params: { url: string }) => {
    const protocol = URL.canParse(params.url) ? new URL(params.url).protocol : undefined;
    // Anything else (javascript:, data:, file:, ...) would run code or read local files, not open a page.
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new McpError(ErrorCode.InvalidParams, 'Studio only opens http and https links from MCP Apps');
    }
    window.open(params.url, '_blank', 'noopener,noreferrer');
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
        // The app sets its root `color-scheme` from the theme we send it. If the iframe's own scheme
        // differs, the browser paints an opaque canvas behind the app instead of letting it show
        // through, so the frame declares the same scheme.
        colorScheme: resolvedTheme,
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
        hostCapabilities={hostCapabilities}
        hostContext={hostContext}
        onCallTool={handleCallTool}
        onMessage={handleMessage}
        onFallbackRequest={handleFallbackRequest}
        onOpenLink={handleOpenLink}
        onSizeChanged={handleSizeChanged}
        onError={handleError}
      />
    </div>
  );
}
