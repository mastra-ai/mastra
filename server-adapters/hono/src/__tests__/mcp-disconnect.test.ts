import process from 'node:process';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import { describe, expect, it } from 'vitest';
import { propagateClientDisconnect } from '../mcp-disconnect';

/**
 * Reproduces https://github.com/mastra-ai/mastra/issues/20332.
 *
 * An MCP Streamable HTTP session is served through the `fetch-to-node` bridge. When the client
 * disconnects, the returned body stream is cancelled, but nothing informs the simulated Node
 * response. The MCP transport therefore keeps its SSE keep-alive timer armed and eventually
 * writes into a closed stream controller from a timer callback, crashing the process with an
 * uncatchable ERR_INVALID_STATE.
 */
function startSseSession() {
  const { res } = toReqRes(new Request('http://localhost/mcp', { method: 'GET' }));
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  // Headers are only flushed on the first write, which is what resolves `toFetchResponse`.
  res.write(':\n\n');
  return res;
}

/**
 * Mirrors the contract in `@modelcontextprotocol/node`'s `toNodeHandler`, which aborts the
 * request controller on `res` "close". That abort is what tears down the SSE stream and clears
 * the keep-alive timer.
 */
function attachTransportCloseContract(res: { on: (event: string, cb: () => void) => void }) {
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  return abort.signal;
}

describe('MCP client disconnect (issue #20332)', () => {
  it('emits close on the simulated Node response when the client disconnects', async () => {
    const res = startSseSession();
    let closeEvents = 0;
    res.on('close', () => closeEvents++);

    const response = propagateClientDisconnect(await toFetchResponse(res), res);

    expect(closeEvents).toBe(0);
    await response.body!.cancel();

    expect(closeEvents).toBe(1);
  });

  it('aborts the transport request signal so the keep-alive timer is cleared', async () => {
    const res = startSseSession();
    const signal = attachTransportCloseContract(res);

    const response = propagateClientDisconnect(await toFetchResponse(res), res);
    expect(signal.aborted).toBe(false);

    await response.body!.cancel();

    // Without propagation the transport never learns the client is gone and keeps writing.
    expect(signal.aborted).toBe(true);
  });

  it('does not crash when a keep-alive write lands after the client disconnected', async () => {
    const res = startSseSession();
    const signal = attachTransportCloseContract(res);

    const response = propagateClientDisconnect(await toFetchResponse(res), res);
    await response.body!.cancel();

    expect(signal.aborted).toBe(true);

    // The MCP keep-alive tick is a timer callback, and the bridge flushes writes from a cork
    // timer - so a bad write surfaces as an *uncaught* exception, not a throw at the call site.
    // Capture process-level failures across the flush to prove the process would survive.
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => uncaught.push(error);
    process.on('uncaughtException', onUncaught);
    try {
      res.write(': keepalive\n\n');
      await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
      process.off('uncaughtException', onUncaught);
    }

    expect(uncaught).toEqual([]);
  });

  it('streams data through to the client while the session is live', async () => {
    const res = startSseSession();
    const response = propagateClientDisconnect(await toFetchResponse(res), res);

    res.write('event: message\ndata: {"jsonrpc":"2.0"}\n\n');
    res.end();

    expect(await response.text()).toContain('"jsonrpc":"2.0"');
  });
});
