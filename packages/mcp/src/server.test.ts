import http from 'http';
import path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { weatherTool } from './__fixtures__/tools';
import { MCPClient } from './configuration';
import { MCPServer } from './server';

const PORT = 9100 + Math.floor(Math.random() * 1000);
let server: MCPServer;
let httpServer: http.Server;

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

describe('MCPServer', () => {
  beforeAll(async () => {
    server = new MCPServer({
      name: 'Test MCP Server',
      version: '0.1.0',
      tools: { weatherTool },
    });

    httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      await server.startSSE({
        url,
        ssePath: '/sse',
        messagePath: '/message',
        req,
        res,
      });
    });

    await new Promise(resolve => httpServer.listen(PORT, resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => httpServer.close(resolve));
  });

  describe('MCPServer SSE transport', () => {
    let sseRes: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    afterEach(async () => {
      if (reader) {
        try {
          await reader.cancel();
        } catch {}
        reader = undefined;
      }
      if (sseRes && 'body' in sseRes && sseRes.body) {
        try {
          await sseRes.body.cancel();
        } catch {}
        sseRes = undefined;
      }
    });

    it('should parse SSE stream and contain tool output', async () => {
      sseRes = await fetch(`http://localhost:${PORT}/sse`, {
        headers: { Accept: 'text/event-stream' },
      });
      expect(sseRes.status).toBe(200);
      reader = sseRes.body?.getReader();
      expect(reader).toBeDefined();
      await fetch(`http://localhost:${PORT}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'weatherTool', input: { location: 'Austin' } }),
      });
      if (reader) {
        const { value } = await reader.read();
        const text = value ? new TextDecoder().decode(value) : '';
        expect(text).toMatch(/data:/);
      }
    });

    it('should return 503 if message sent before SSE connection', async () => {
      // Manually clear the SSE transport
      (server as any).sseTransport = undefined;
      const res = await fetch(`http://localhost:${PORT}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'weatherTool', input: { location: 'Austin' } }),
      });
      expect(res.status).toBe(503);
    });
  });

  describe('MCPServer stdio transport', () => {
    it('should connect and expose stdio transport', async () => {
      await server.startStdio();
      expect(server.getStdioTransport()).toBeInstanceOf(StdioServerTransport);
    });
    it('should use stdio transport to get tools', async () => {
      const existingConfig = new MCPClient({
        servers: {
          weather: {
            command: 'npx',
            args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/server-weather.ts')],
            env: {
              FAKE_CREDS: 'test',
            },
          },
        },
      });

      const tools = await existingConfig.getTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
      expect(Object.keys(tools)[0]).toBe('weather_weatherTool');
      await existingConfig.disconnect();
    });
  });
});
