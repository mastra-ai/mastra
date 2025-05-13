import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'path';
import { MCPClient } from '@mastra/mcp';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

// Helper to find an available port
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

describe('MCPServer through Mastra HTTP Integration (Subprocess)', () => {
  let mastraServer: ReturnType<typeof spawn>;
  let port: number;
  const mcpServerId = 'myMcpServer';
  const testToolId = 'calculator';
  let client: MCPClient;

  beforeAll(async () => {
    port = await getAvailablePort();

    mastraServer = spawn(
      'pnpm',
      [
        path.resolve(import.meta.dirname, `..`, `..`, `..`, `cli`, `dist`, `index.js`),
        'dev',
        '--port',
        port.toString(),
      ],
      {
        stdio: 'pipe',
        detached: true, // Run in a new process group so we can kill it and children
      },
    );

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      let output = '';
      mastraServer.stdout?.on('data', data => {
        output += data.toString();
        console.log(output);
        if (output.includes('http://localhost:')) {
          resolve();
        }
      });
      mastraServer.stderr?.on('data', data => {
        console.error('Mastra server error:', data.toString());
      });

      setTimeout(() => reject(new Error('Mastra server failed to start')), 10000);
    });

    client = new MCPClient({
      servers: {
        [mcpServerId]: {
          url: new URL(`http://localhost:${port}/api/servers/${mcpServerId}/mcp`),
        },
      },
    });
  });

  afterAll(() => {
    // Kill the server and its process group
    if (mastraServer?.pid) {
      try {
        process.kill(-mastraServer.pid, 'SIGTERM');
      } catch (e) {
        console.error('Failed to kill Mastra server:', e);
      }
    }
  });

  it('should allow an HTTP client to call a tool via Mastra MCP endpoint (Subprocess)', async () => {
    const toolCallPayload = {
      jsonrpc: '2.0',
      id: `test-${Date.now()}`,
      method: 'CallTool',
      params: {
        name: testToolId,
        args: { num1: 10, num2: 5, operation: 'add' },
      },
    };

    const tools = await client.getTools();
    console.log('Tools:', tools);

    const tool = tools['myMcpServer_calculator'];
    console.log('Tool:', tool);

    const result = await tool.execute({ context: toolCallPayload.params.args });
    console.log('Result:', result);

    expect(result).toBeDefined();
    expect(result.isError).toBe(false);
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content.length).toBeGreaterThan(0);

    const toolOutput = result.content[0];
    expect(toolOutput.type).toBe('text');

    const expectedToolResult = 15;
    expect(JSON.parse(toolOutput.text)).toEqual(expectedToolResult);
  }, 25000);

  it('should allow a client to call a tool via Mastra MCP SSE endpoints (Subprocess)', async () => {
    const sseUrl = new URL(`http://localhost:${port}/api/servers/${mcpServerId}/sse`);

    // Configure MCPClient for SSE transport
    const sseClient = new MCPClient({
      servers: {
        [mcpServerId]: {
          url: sseUrl, // URL for establishing SSE connection
        },
      },
    });

    const toolCallPayloadParams = { num1: 10, num2: 5, operation: 'add' };

    // Get tools (this will connect the client internally if not already connected)
    const tools = await sseClient.getTools();

    const toolName = `${mcpServerId}_${testToolId}`;
    const tool = tools[toolName];
    expect(tool, `Tool '${toolName}' should be available via SSE client`).toBeDefined();

    // Execute the tool
    const result = await tool.execute({ context: toolCallPayloadParams });

    expect(result).toBeDefined();
    expect(result.isError).toBe(false);
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content.length).toBeGreaterThan(0);

    const toolOutput = result.content[0];
    expect(toolOutput.type).toBe('text');

    const expectedToolResult = 15; // 10 + 5
    expect(JSON.parse(toolOutput.text)).toEqual(expectedToolResult);
  }, 25000);
});
