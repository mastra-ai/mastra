import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { TextEncoder } from 'node:util';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { AgentBuilder } from './agent-builder';

const RECORD_SEPARATOR = '\x1E';

describe('AgentBuilder.streamVNext', () => {
  let server: Server;
  let encoder: TextEncoder;
  let serverPort: number;
  let agentBuilder: AgentBuilder;

  // Helper function to set up streaming response
  const setupStreamingResponse = (chunks: string[]) => {
    server.once('request', (req, res) => {
      if (req.url?.includes('/api/agent-builder/test-action-id/streamVNext')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        });

        // Write first chunk immediately
        res.write(encoder.encode(chunks[0]));

        // Write remaining chunks with small delay
        if (chunks.length > 1) {
          setTimeout(() => {
            chunks.slice(1).forEach(chunk => {
              res.write(encoder.encode(chunk));
            });
            res.end();
          }, 10);
        } else {
          res.end();
        }
      }
    });
  };

  beforeAll(async () => {
    server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    serverPort = (server.address() as any).port;
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  beforeEach(() => {
    encoder = new TextEncoder();
    agentBuilder = new AgentBuilder({ baseUrl: `http://127.0.0.1:${serverPort}` }, 'test-action-id');
  });

  it('should handle partial JSON chunks across multiple received chunks', async () => {
    // Arrange: Configure server to stream partial JSON chunks
    const chunks = ['{"type":"test","payl', 'oad":"data"}' + RECORD_SEPARATOR];
    setupStreamingResponse(chunks);

    // Act: Call streamVNext and collect transformed chunks
    const stream = await agentBuilder.streamVNext({ runtimeContext: {} });
    const reader = stream.getReader();
    const results: Array<{ type: string; payload: any }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }

    // Assert: Verify complete JSON object
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      type: 'test',
      payload: 'data',
    });
  });

  it('should process multiple independent JSON chunks correctly after parsing previous chunks', async () => {
    // Arrange: Configure server to stream multiple complete JSON objects
    const chunks = [
      JSON.stringify({ type: 'first', payload: 'data1' }) + RECORD_SEPARATOR,
      JSON.stringify({ type: 'second', payload: 'data2' }) + RECORD_SEPARATOR,
    ];
    setupStreamingResponse(chunks);

    // Act: Call streamVNext and collect all chunks
    const stream = await agentBuilder.streamVNext({ runtimeContext: {} });
    const reader = stream.getReader();
    const results: Array<{ type: string; payload: any }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }

    // Assert: Verify multiple JSON objects
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      type: 'first',
      payload: 'data1',
    });
    expect(results[1]).toEqual({
      type: 'second',
      payload: 'data2',
    });
  });

  it('should properly handle empty chunks from consecutive record separators', async () => {
    // Arrange: Configure server to stream chunks with empty segments
    const firstJson = { type: 'first', payload: 'data1' };
    const secondJson = { type: 'second', payload: 'data2' };
    const chunks = [
      JSON.stringify(firstJson) + RECORD_SEPARATOR + RECORD_SEPARATOR,
      JSON.stringify(secondJson) + RECORD_SEPARATOR,
    ];
    setupStreamingResponse(chunks);

    // Act: Call streamVNext and collect transformed chunks
    const stream = await agentBuilder.streamVNext({ runtimeContext: {} });
    const reader = stream.getReader();
    const results: Array<{ type: string; payload: any }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }

    // Assert: Verify only non-empty chunks were processed
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(firstJson);
    expect(results[1]).toEqual(secondJson);
  });
});
