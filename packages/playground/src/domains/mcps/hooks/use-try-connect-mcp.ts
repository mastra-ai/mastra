import { useMastraClient } from '@mastra/react';
import { useMutation } from '@tanstack/react-query';

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface TryConnectResult {
  tools: McpTool[];
}

/**
 * Stored MCP clients are driven at runtime by `@mastra/mcp`, which speaks only the
 * 2026-07-28 revision. The probe uses the same self-contained request shape so a
 * successful "try connect" means the server will also work at runtime.
 */
export const TRY_CONNECT_PROTOCOL_VERSION = '2026-07-28';

interface JsonRpcResponse {
  id?: number | string | null;
  result?: { tools?: McpTool[] };
  error?: { code?: number; message?: string };
}

async function parseResponse(response: Response): Promise<JsonRpcResponse> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const messages = text
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trim())
      .filter(Boolean)
      .map(data => JSON.parse(data) as JsonRpcResponse);

    // Notifications (no id) may precede the response on the stream.
    const reply = messages.find(message => message.id !== undefined && message.id !== null);
    if (!reply) {
      throw new Error('No response found in SSE stream');
    }
    return reply;
  }

  return (await response.json()) as JsonRpcResponse;
}

async function connectAndListTools(url: string, clientHeaders?: Record<string, string>): Promise<TryConnectResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': TRY_CONNECT_PROTOCOL_VERSION,
      'Mcp-Method': 'tools/list',
    },
    credentials: 'include',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': TRY_CONNECT_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': { name: 'mastra-playground', version: '1.0.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await parseResponse(response);
      detail = body.error?.message ? `: ${body.error.message}` : '';
    } catch {
      // fall through with the HTTP status only
    }
    throw new Error(`tools/list failed: ${response.status} ${response.statusText}${detail}`);
  }

  const reply = await parseResponse(response);
  if (reply.error) {
    throw new Error(`tools/list failed: ${reply.error.message ?? `code ${reply.error.code}`}`);
  }

  return {
    tools: reply.result?.tools ?? [],
  };
}

export const useTryConnectMcp = () => {
  const client = useMastraClient();
  const clientHeaders = (client.options?.headers as Record<string, string>) ?? {};

  return useMutation({
    mutationFn: (url: string) => connectAndListTools(url, clientHeaders),
  });
};

export type TryConnectMcpMutation = ReturnType<typeof useTryConnectMcp>;
