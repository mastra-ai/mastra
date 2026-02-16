import { useMutation } from '@tanstack/react-query';

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface TryConnectResult {
  tools: McpTool[];
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice('data:'.length).trim();
        if (data) {
          return JSON.parse(data);
        }
      }
    }

    throw new Error('No data found in SSE response');
  }

  return response.json();
}

async function connectAndListTools(url: string): Promise<TryConnectResult> {
  // Step 1: Initialize
  const initResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'mastra-playground', version: '1.0.0' },
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`Initialize failed: ${initResponse.status} ${initResponse.statusText}`);
  }

  const sessionId = initResponse.headers.get('Mcp-Session-Id');
  await parseResponse(initResponse);

  const sessionHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) {
    sessionHeaders['Mcp-Session-Id'] = sessionId;
  }

  // Step 2: Send initialized notification
  await fetch(url, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  // Step 3: List tools
  const toolsResponse = await fetch(url, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    }),
  });

  if (!toolsResponse.ok) {
    throw new Error(`tools/list failed: ${toolsResponse.status} ${toolsResponse.statusText}`);
  }

  const toolsResult = (await parseResponse(toolsResponse)) as { result?: { tools?: McpTool[] } };

  return {
    tools: toolsResult.result?.tools ?? [],
  };
}

export const useTryConnectMcp = () => {
  return useMutation({
    mutationFn: (url: string) => connectAndListTools(url),
  });
};

export type TryConnectMcpMutation = ReturnType<typeof useTryConnectMcp>;
