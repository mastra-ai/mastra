import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MessageSendParams } from '@mastra/core/a2a';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
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
        expect(req.url).toBe('/api/a2a/test-agent');

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

    it('should allow reading the stream chunk by chunk', async () => {
      // Arrange: Set up server with multiple streaming chunks using record separator
      const chunks = [
        { jsonrpc: '2.0', result: { state: 'working', message: { text: 'Processing...' } } },
        { jsonrpc: '2.0', result: { state: 'working', message: { text: 'Almost done...' } } },
        { jsonrpc: '2.0', result: { state: 'completed', message: { text: 'Done!' } } },
      ];

      server.on('request', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });

        // Send chunks with record separator (0x1E) as delimiter
        for (const chunk of chunks) {
          res.write(JSON.stringify(chunk) + '\x1E');
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

      // Act: Call sendStreamingMessage and read the stream
      const response = (await a2a.sendStreamingMessage(params)) as unknown as Response;
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      const receivedChunks: any[] = [];
      let buffer = '';

      // Read chunks from the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse chunks separated by record separator (0x1E)
        const parts = buffer.split('\x1E');
        buffer = parts.pop() || ''; // Keep incomplete chunk in buffer

        for (const part of parts) {
          if (part.trim()) {
            receivedChunks.push(JSON.parse(part));
          }
        }
      }

      // Assert: We should have received all chunks in order
      expect(receivedChunks).toHaveLength(3);
      expect(receivedChunks[0].result.state).toBe('working');
      expect(receivedChunks[0].result.message.text).toBe('Processing...');
      expect(receivedChunks[1].result.state).toBe('working');
      expect(receivedChunks[1].result.message.text).toBe('Almost done...');
      expect(receivedChunks[2].result.state).toBe('completed');
      expect(receivedChunks[2].result.message.text).toBe('Done!');
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

    it('should include JSON-RPC 2.0 fields in the request body', async () => {
      let receivedBody: any;

      server.on('request', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          receivedBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: receivedBody.id, result: {} }));
        });
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

      await a2a.sendMessage(params);

      expect(receivedBody.jsonrpc).toBe('2.0');
      expect(receivedBody.id).toBeDefined();
      expect(typeof receivedBody.id).toBe('string');
      expect(receivedBody.method).toBe('message/send');
      expect(receivedBody.params).toEqual(params);
    });
  });
});
