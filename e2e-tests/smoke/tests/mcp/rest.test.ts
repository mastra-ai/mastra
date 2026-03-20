import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('MCP REST API', () => {
  describe('server discovery', () => {
    it('should list registered MCP servers', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/v0/servers');

      expect(status).toBe(200);
      expect(data.total_count).toBeGreaterThanOrEqual(1);
      expect(data.next).toBeNull();

      const server = data.servers.find((s: any) => s.name === 'Test MCP Server');
      expect(server).toBeDefined();
      expect(server.version_detail.version).toBe('1.0.0');
      expect(server.version_detail.is_latest).toBe(true);
    });

    it('should get server details by ID', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/v0/servers/test-mcp');

      expect(status).toBe(200);
      expect(data.name).toBe('Test MCP Server');
      expect(data.version_detail.version).toBe('1.0.0');
    });

    it('should return 404 for non-existent server', async () => {
      const res = await fetchApi('/api/mcp/v0/servers/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('tool discovery', () => {
    it('should list tools on the MCP server', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/test-mcp/tools');

      expect(status).toBe(200);
      expect(data.tools).toBeDefined();

      const toolNames = data.tools.map((t: any) => t.name);
      expect(toolNames).toContain('calculator');
      expect(toolNames).toContain('string-transform');
    });

    it('should get tool details with input schema', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/test-mcp/tools/calculator');

      expect(status).toBe(200);
      expect(data.name).toBe('calculator');
      expect(data.description).toBe('Performs basic arithmetic operations');
      expect(data.inputSchema).toBeDefined();
      expect(data.inputSchema.properties).toHaveProperty('operation');
      expect(data.inputSchema.properties).toHaveProperty('a');
      expect(data.inputSchema.properties).toHaveProperty('b');
    });

    it('should return 404 for non-existent tool on valid server', async () => {
      const res = await fetchApi('/api/mcp/test-mcp/tools/does-not-exist');
      expect(res.status).toBe(404);
    });

    it('should return 404 for tool on non-existent server', async () => {
      const res = await fetchApi('/api/mcp/does-not-exist/tools/calculator');
      expect(res.status).toBe(404);
    });
  });

  describe('tool execution', () => {
    it('should execute calculator via MCP REST endpoint', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/test-mcp/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'multiply', a: 7, b: 6 },
        }),
      });

      expect(status).toBe(200);
      expect(data.result).toEqual({ result: 42 });
    });

    it('should execute string-transform via MCP REST endpoint', async () => {
      const { status, data } = await fetchJson<any>('/api/mcp/test-mcp/tools/string-transform/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { text: 'mastra', transform: 'reverse' },
        }),
      });

      expect(status).toBe(200);
      expect(data.result).toEqual({ result: 'artsam' });
    });

    it('should return 500 when executing non-existent tool', async () => {
      const res = await fetchApi('/api/mcp/test-mcp/tools/does-not-exist/execute', {
        method: 'POST',
        body: JSON.stringify({ data: {} }),
      });

      // MCP executeTool throws "Unknown tool" which surfaces as 500
      expect(res.status).toBe(500);
    });
  });
});
