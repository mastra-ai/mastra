import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { describe, expect, it } from 'vitest';

/**
 * Regression for #20332: MCP Streamable-HTTP nests @hono/node-server inside a
 * fetch-to-node simulated Node response. When the outer Web ReadableStream is
 * cancelled (client disconnect), fetch-to-node must emit `close` on that
 * response so the inner bridge cancels MCP's SSE keepalive. Guards alone stop
 * the crash but leave the 15s keepalive orphaned.
 */
describe('fetch-to-node cancel close propagation (#20332)', () => {
  it('emits close on the simulated Node response when the fetch body is cancelled', async () => {
    const request = new Request('http://127.0.0.1/api/mcp/test-mcp/mcp', {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });
    const { res } = toReqRes(request);

    const closePromise = new Promise<void>(resolve => {
      res.once('close', () => resolve());
    });

    // Headers + body start so _toFetchResponse builds a live ReadableStream.
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': early\n\n');

    const fetchResponse = await toFetchResponse(res);
    expect(fetchResponse.body).not.toBeNull();

    await fetchResponse.body!.cancel();
    await expect(closePromise).resolves.toBeUndefined();

    // Late write after cancel must not throw (guarded enqueue path).
    expect(() => {
      res.write(': keepalive\n\n');
    }).not.toThrow();
  });
});
