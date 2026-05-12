import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '@mastra/mcp';
import { getBaseUrl } from '../utils.js';

describe('MCP client transport', () => {
  describe('Streamable HTTP transport', () => {
    let client: MCPClient;

    beforeAll(async () => {
      const baseUrl = getBaseUrl();
      client = new MCPClient({
        id: 'smoke-http',
        servers: {
          'test-mcp': {
            url: new URL(`${baseUrl}/api/mcp/test-mcp/mcp`),
          },
        },
      });
    });

    afterAll(async () => {
      await client?.disconnect();
    });

    it('should connect and list tools via Streamable HTTP', async () => {
      const tools = await client.listTools();

      // Tools are namespaced as serverName_toolName
      const toolNames = Object.keys(tools);
      expect(toolNames).toContain('test-mcp_calculator');
      expect(toolNames).toContain('test-mcp_string-transform');
    });

    it('should execute calculator tool via Streamable HTTP', async () => {
      const tools = await client.listTools();
      const calculator = tools['test-mcp_calculator'];
      expect(calculator, 'calculator tool not found').toBeDefined();
      expect(calculator.execute, 'calculator tool has no execute method').toBeDefined();

      const result = await calculator.execute({ operation: 'add', a: 10, b: 32 });

      expect(result).toEqual({ result: 42 });
    });

    it('should execute string-transform tool via Streamable HTTP', async () => {
      const tools = await client.listTools();
      const transform = tools['test-mcp_string-transform'];
      expect(transform, 'string-transform tool not found').toBeDefined();
      expect(transform.execute, 'string-transform tool has no execute method').toBeDefined();

      const result = await transform.execute({ text: 'hello world', transform: 'upper' });

      expect(result).toEqual({ result: 'HELLO WORLD' });
    });
  });

  describe('SSE transport', () => {
    let client: MCPClient;

    beforeAll(async () => {
      const baseUrl = getBaseUrl();
      client = new MCPClient({
        id: 'smoke-sse',
        servers: {
          'test-mcp': {
            url: new URL(`${baseUrl}/api/mcp/test-mcp/sse`),
          },
        },
      });
    });

    afterAll(async () => {
      await client?.disconnect();
    });

    it('should connect and list tools via SSE fallback', async () => {
      const tools = await client.listTools();

      const toolNames = Object.keys(tools);
      expect(toolNames).toContain('test-mcp_calculator');
      expect(toolNames).toContain('test-mcp_string-transform');
    });

    it('should execute calculator tool via SSE transport', async () => {
      const tools = await client.listTools();
      const calculator = tools['test-mcp_calculator'];
      expect(calculator, 'calculator tool not found').toBeDefined();
      expect(calculator.execute, 'calculator tool has no execute method').toBeDefined();

      const result = await calculator.execute({ operation: 'subtract', a: 100, b: 58 });

      expect(result).toEqual({ result: 42 });
    });

    it('should execute string-transform tool via SSE transport', async () => {
      const tools = await client.listTools();
      const transform = tools['test-mcp_string-transform'];
      expect(transform, 'string-transform tool not found').toBeDefined();
      expect(transform.execute, 'string-transform tool has no execute method').toBeDefined();

      const result = await transform.execute({ text: 'mastra', transform: 'reverse' });

      expect(result).toEqual({ result: 'artsam' });
    });
  });
});
