import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MessageSendParams } from '@mastra/core/a2a';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { A2A } from './a2a';

describe('A2A', () => {
  let server: Server;
  let serverUrl: string;

  beforeEach(async () => {
    server = createServer();

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });

  describe('sendStreamingMessage', () => {
    it('should return the raw response for streaming instead of parsing as JSON', async () => {
      // Arrange: Set up server to return streaming response
      const streamingData = [
        JSON.stringify({ jsonrpc: '2.0', result: { state: 'working' } }),
        JSON.stringify({ jsonrpc: '2.0', result: { state: 'completed', text: 'Hello!' } }),
      ];

      server.on('request', (req, res) => {
        // Verify it's a POST to the A2A endpoint with message/stream method
        expect(req.method).toBe('POST');
        expect(req.url).toBe('/a2a/test-agent');

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });

        // Send streaming chunks
        for (const chunk of streamingData) {
          res.write(chunk + '\x1E');
        }
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const params: MessageSendParams = {
        message: {
          messageId: 'msg-1',
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Hello' }],
        },
      };

      // Act: Call sendStreamingMessage
      const response = await a2a.sendStreamingMessage(params);

      // Assert: Response should be a Response object (not parsed JSON)
      // This verifies that stream: true is being passed to the request method
      expect(response).toBeInstanceOf(Response);

      // Read the body to verify we get the streaming data
      const bodyText = await (response as unknown as Response).text();
      expect(bodyText).toContain('working');
      expect(bodyText).toContain('completed');
    });

    it('should not throw JSON parse error for streaming responses', async () => {
      // Arrange: Set up server to return non-JSON streaming response
      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"state": "working"}\n\n');
        res.write('data: {"state": "completed"}\n\n');
        res.end();
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const params: MessageSendParams = {
        message: {
          messageId: 'msg-1',
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Hello' }],
        },
      };

      // Act & Assert: Should NOT throw SyntaxError for JSON parsing
      // Before the fix, this would throw: "SyntaxError: Unexpected non-whitespace character after JSON"
      await expect(a2a.sendStreamingMessage(params)).resolves.toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should parse JSON response for non-streaming requests', async () => {
      // Arrange: Set up server to return JSON response
      const mockResponse = {
        jsonrpc: '2.0',
        id: 'req-1',
        result: {
          id: 'task-1',
          status: { state: 'completed', message: { text: 'Done!' } },
        },
      };

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });

      const a2a = new A2A({ baseUrl: serverUrl }, 'test-agent');
      const params: MessageSendParams = {
        message: {
          messageId: 'msg-1',
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Hello' }],
        },
      };

      // Act
      const response = await a2a.sendMessage(params);

      // Assert: Response should be parsed JSON
      expect(response).toEqual(mockResponse);
    });
  });
});
