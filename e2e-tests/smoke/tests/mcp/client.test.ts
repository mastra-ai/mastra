import { describe, it, expect, afterAll } from 'vitest';
import { MCPClient } from '@mastra/mcp';
import { getBaseUrl } from '../utils.js';

describe('MCP client transport', () => {
  describe('Streamable HTTP transport', () => {
    let client: MCPClient;

    afterAll(async () => {
      await client?.disconnect();
    });

    it('should connect and list tools via Streamable HTTP', async () => {
      const baseUrl = getBaseUrl();
      client = new MCPClient({
        id: 'smoke-http',
        servers: {
          'test-mcp': {
            url: new URL(`${baseUrl}/api/mcp/test-mcp/mcp`),
          },
        },
      });

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

      const result = await calculator.execute!({ operation: 'add', a: 10, b: 32 });

      // MCP tool results come as { content: [{ type: 'text', text: '...' }] }
      expect(result).toBeDefined();
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      // The result might be wrapped differently depending on transport
      // Check for the actual value in either format
      if (parsed.content) {
        const textContent = parsed.content.find((c: any) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(JSON.parse(textContent.text)).toEqual({ result: 42 });
      } else {
        expect(parsed).toEqual({ result: 42 });
      }
    });

    it('should execute string-transform tool via Streamable HTTP', async () => {
      const tools = await client.listTools();
      const transform = tools['test-mcp_string-transform'];
      expect(transform, 'string-transform tool not found').toBeDefined();

      const result = await transform.execute!({ text: 'hello world', transform: 'upper' });

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.content) {
        const textContent = parsed.content.find((c: any) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(JSON.parse(textContent.text)).toEqual({ result: 'HELLO WORLD' });
      } else {
        expect(parsed).toEqual({ result: 'HELLO WORLD' });
      }
    });
  });

  describe('SSE transport', () => {
    let client: MCPClient;

    afterAll(async () => {
      await client?.disconnect();
    });

    it('should connect and list tools via SSE fallback', async () => {
      const baseUrl = getBaseUrl();
      client = new MCPClient({
        id: 'smoke-sse',
        servers: {
          'test-mcp': {
            url: new URL(`${baseUrl}/api/mcp/test-mcp/sse`),
          },
        },
      });

      const tools = await client.listTools();

      const toolNames = Object.keys(tools);
      expect(toolNames).toContain('test-mcp_calculator');
      expect(toolNames).toContain('test-mcp_string-transform');
    });

    it('should execute calculator tool via SSE transport', async () => {
      const tools = await client.listTools();
      const calculator = tools['test-mcp_calculator'];
      expect(calculator, 'calculator tool not found').toBeDefined();

      const result = await calculator.execute!({ operation: 'subtract', a: 100, b: 58 });

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.content) {
        const textContent = parsed.content.find((c: any) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(JSON.parse(textContent.text)).toEqual({ result: 42 });
      } else {
        expect(parsed).toEqual({ result: 42 });
      }
    });
  });
});
