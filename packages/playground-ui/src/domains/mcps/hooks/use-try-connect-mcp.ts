import { useMutation } from '@tanstack/react-query';

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface TryConnectResult {
  tools: McpTool[];
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
  await initResponse.json();

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

  const toolsResult = await toolsResponse.json();

  return {
    tools: toolsResult.result?.tools ?? [],
  };
}

export const useTryConnectMcp = () => {
  return useMutation({
    mutationFn: (url: string) => connectAndListTools(url),
  });
};
