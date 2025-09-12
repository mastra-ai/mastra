import type { Server } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { AgentBuilder } from './agent-builder';

describe('AgentBuilder.stream', () => {
  let server: Server;
  let agentBuilder: AgentBuilder;
  let serverAddress: string;
  let responseWriter: any;
  const RECORD_SEPARATOR = '\x1E';

  beforeEach(async () => {
    responseWriter = undefined;

    server = createServer((req, res) => {
      responseWriter = res;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
    });

    await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
    const address = server.address() as AddressInfo;
    serverAddress = `http://localhost:${address.port}`;

    agentBuilder = new AgentBuilder({ baseUrl: serverAddress }, 'test-action-id');
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('should handle split JSON chunks correctly', async () => {
    // Arrange: Create a complete JSON object to split across chunks
    const completeJson = { type: 'test', payload: { message: 'Hello World' } };
    const jsonStr = JSON.stringify(completeJson);
    const splitPoint = Math.floor(jsonStr.length / 2);
    const firstChunk = jsonStr.substring(0, splitPoint);
    const secondChunk = jsonStr.substring(splitPoint);
    const results: any[] = [];

    // Act: Start streaming and send chunks
    const stream = await agentBuilder.stream({ runtimeContext: {} });
    const reader = stream.getReader();

    // Process the stream in the background
    const processingPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        results.push(value);
      }
    })();

    // Ensure server handler has run
    await new Promise(resolve => setTimeout(resolve, 10));

    // Send first (incomplete) chunk - no record separator yet
    responseWriter.write(firstChunk);

    // Allow processing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Assert: No results yet with incomplete JSON
    expect(results.length).toBe(0);

    // Send second chunk with record separator
    responseWriter.write(secondChunk + RECORD_SEPARATOR);
    await new Promise(resolve => setTimeout(resolve, 50));

    // End the stream
    responseWriter.end();
    await processingPromise;

    // Assert: Verify complete object
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(completeJson);
  });

  it('should handle sequential invalid and valid JSON chunks', async () => {
    // Arrange: Send an incomplete JSON chunk first, then a completion to form a valid JSON
    const invalidPartial = '{"type": "test", "payload":';
    const completion = '{"message":"Complete"}}';
    const expected = { type: 'test', payload: { message: 'Complete' } };
    const results: any[] = [];

    // Act: Start streaming and send chunks
    const stream = await agentBuilder.stream({ runtimeContext: {} });
    const reader = stream.getReader();

    // Process the stream in the background
    const processingPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        results.push(value);
      }
    })();

    // Ensure server handler has run
    await new Promise(resolve => setTimeout(resolve, 10));

    // Send invalid (incomplete) chunk without record separator
    responseWriter.write(invalidPartial);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Assert: No results yet with incomplete JSON
    expect(results.length).toBe(0);

    // Send completion + record separator to complete the JSON
    responseWriter.write(completion + RECORD_SEPARATOR);
    await new Promise(resolve => setTimeout(resolve, 50));

    // End the stream
    responseWriter.end();
    await processingPromise;

    // Assert: Verify complete object
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(expected);
  });

  it('should process multiple complete JSON objects from a single chunk', async () => {
    // Arrange: Create multiple complete JSON objects
    const objects = [
      { type: 'status', payload: { message: 'Starting' } },
      { type: 'progress', payload: { percent: 50 } },
      { type: 'status', payload: { message: 'Complete' } },
    ];
    const combinedChunk = objects.map(obj => JSON.stringify(obj)).join(RECORD_SEPARATOR);
    const results: any[] = [];

    // Act: Start streaming and process the chunk
    const stream = await agentBuilder.stream({ runtimeContext: {} });
    const reader = stream.getReader();

    const processingPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        results.push(value);
      }
    })();

    // Ensure server handler has run
    await new Promise(resolve => setTimeout(resolve, 10));

    // Send the combined chunk with separator
    responseWriter?.write(combinedChunk + RECORD_SEPARATOR);
    await new Promise(resolve => setTimeout(resolve, 50));

    // End the stream
    responseWriter?.end();
    await processingPromise;

    // Assert: Verify all objects were processed correctly and in order
    expect(results.length).toBe(3);
    expect(results).toEqual(objects);
  });

  it('should buffer incomplete JSON across chunks and resume parsing once complete', async () => {
    // Arrange: Create JSON objects split across chunks
    const firstObject = { type: 'status', payload: { message: 'Split message' } };
    const secondObject = { type: 'status', payload: { message: 'Complete message' } };

    const firstObjectStr = JSON.stringify(firstObject);
    const splitPoint = Math.floor(firstObjectStr.length / 2);
    const chunk1 = firstObjectStr.substring(0, splitPoint);
    const chunk2 = firstObjectStr.substring(splitPoint);

    const results: any[] = [];

    // Act: Start streaming and process chunks
    const stream = await agentBuilder.stream({ runtimeContext: {} });
    const reader = stream.getReader();

    const processingPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        results.push(value);
      }
    })();

    // Ensure server handler has run
    await new Promise(resolve => setTimeout(resolve, 10));

    // Send first partial chunk
    responseWriter?.write(chunk1);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Assert: No results yet with incomplete JSON
    expect(results.length).toBe(0);

    // Send second chunk completing first JSON and including second complete JSON
    responseWriter?.write(chunk2 + RECORD_SEPARATOR + JSON.stringify(secondObject) + RECORD_SEPARATOR);
    await new Promise(resolve => setTimeout(resolve, 50));

    // End the stream
    responseWriter?.end();
    await processingPromise;

    // Assert: Verify both objects were processed correctly
    expect(results.length).toBe(2);
    expect(results[0]).toEqual(firstObject);
    expect(results[1]).toEqual(secondObject);
  });
});
