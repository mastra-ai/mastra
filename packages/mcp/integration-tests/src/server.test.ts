import { spawn } from 'node:child_process';
import { MCPClient } from '@mastra/mcp';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ServerInfo } from '@mastra/core/mcp';
import path from 'node:path';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

describe('MCPServer through Mastra HTTP Integration (Subprocess)', () => {
  let mastraServer: ReturnType<typeof spawn>;
  const port: number = 4114;
  const mcpServerId = 'myMcpServer';
  const testToolId = 'calculator';
  let client: MCPClient;

  beforeAll(async () => {
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

      setTimeout(() => reject(new Error('Mastra server failed to start')), 100000);
    });

    client = new MCPClient({
      servers: {
        [mcpServerId]: {
          url: new URL(`http://localhost:${port}/api/mcp/${mcpServerId}/mcp`),
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
    const sseUrl = new URL(`http://localhost:${port}/api/mcp/${mcpServerId}/sse`);

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

  // --- New tests for MCP Registry API Style Routes ---
  describe('MCP Registry API Style Endpoints', () => {
    const defaultMcpServerLogicalId = 'myMcpServer'; // Assuming this is the ID of the default server

    it('GET /api/mcp/v0/servers - should list available MCP servers', async () => {
      const response = await fetch(`http://localhost:${port}/api/mcp/v0/servers`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      const body = await response.json();

      expect(body).toHaveProperty('servers');
      expect(body).toHaveProperty('total_count');
      expect(Array.isArray(body.servers)).toBe(true);
      expect(body.total_count).toBeGreaterThanOrEqual(1); // Expect at least the default server

      const defaultServerInfo: ServerInfo = body.servers.find((s: ServerInfo) => s.id === defaultMcpServerLogicalId);
      expect(defaultServerInfo).toBeDefined();
      expect(defaultServerInfo).toHaveProperty('name');
      expect(defaultServerInfo).toHaveProperty('version_detail');
      // Based on default mastra dev setup, if myMcpServer is the key, its id becomes 'myMcpServer'
      // And its name might be something like 'my-mcp-server' if not explicitly set in MCPServerConfig for it.
      // For this test, we assume the `id` is the key used in Mastra config.
      expect(defaultServerInfo.id).toBe(defaultMcpServerLogicalId);
    });

    it('GET /api/mcp/v0/servers/:id - should get specific server details', async () => {
      // First, get all servers to find the actual version of the default server
      const listResponse = await fetch(`http://localhost:${port}/api/mcp/v0/servers`);
      const listBody = await listResponse.json();
      const defaultServer = listBody.servers.find((s: any) => s.id === defaultMcpServerLogicalId);
      expect(defaultServer).toBeDefined();
      const actualVersion = defaultServer.version_detail.version;

      const response = await fetch(`http://localhost:${port}/api/mcp/v0/servers/${defaultMcpServerLogicalId}`);
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.id).toBe(defaultMcpServerLogicalId);
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('version_detail');
      expect(body.version_detail.version).toBe(actualVersion);
      // Add more assertions for package_canonical, packages, remotes if they are expected for the default server
    });

    it('GET /api/mcp/v0/servers/:id - should get specific server version if it matches', async () => {
      const listResponse = await fetch(`http://localhost:${port}/api/mcp/v0/servers`);
      const listBody = await listResponse.json();
      const defaultServer = listBody.servers.find((s: any) => s.id === defaultMcpServerLogicalId);
      expect(defaultServer).toBeDefined();
      const actualVersion = defaultServer.version_detail.version;

      const response = await fetch(
        `http://localhost:${port}/api/mcp/v0/servers/${defaultMcpServerLogicalId}?version=${actualVersion}`,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(defaultMcpServerLogicalId);
      expect(body.version_detail.version).toBe(actualVersion);
    });

    it('GET /api/mcp/v0/servers/:id - should return 404 if specific server version does not match', async () => {
      const nonExistentVersion = '0.0.0-nonexistent';
      const response = await fetch(
        `http://localhost:${port}/api/mcp/v0/servers/${defaultMcpServerLogicalId}?version=${nonExistentVersion}`,
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain(`but not version '${nonExistentVersion}'`);
    });

    it('GET /api/mcp/v0/servers/:id - should return 404 for a non-existent server ID', async () => {
      const nonExistentId = 'non-existent-server-id-12345';
      const response = await fetch(`http://localhost:${port}/api/mcp/v0/servers/${nonExistentId}`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain(`MCP server with ID '${nonExistentId}' not found`);
    });

    it('GET /api/mcp/v0/servers - should handle pagination (limit=1, offset=0)', async () => {
      const response = await fetch(`http://localhost:${port}/api/mcp/v0/servers?limit=1&offset=0`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.servers.length).toBe(1);
      expect(body.total_count).toBeGreaterThanOrEqual(1);
      if (body.total_count > 1) {
        expect(body.next).not.toBeNull();
      } else {
        expect(body.next).toBeNull();
      }
    });

    it('Should be able to get lazy loaded tools', async () => {
      const agent = await fetch(`http://localhost:${port}/api/agents/test`);
      const agentJson = await agent.json();
      const tools = agentJson.tools;

      expect(tools).toHaveProperty('weather_fetchWeather');
      expect(Object.keys(tools).length).toBe(4);
    });
  });
});
