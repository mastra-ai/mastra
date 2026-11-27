import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

import { MastraClientError } from '../types';
import { Agent } from './agent';

it('rejects a subscribed client-tool continuation with the original error without reconnecting', async () => {
  const runId = 'run-1';
  // The two chunks a subscribed run delivers when a client tool needs a
  // continuation: the tool call itself, then a finish whose step result asks
  // for more tool calls.
  const chunks = [
    { type: 'tool-call', runId, payload: { toolCallId: 'call-1', toolName: 'local', args: {} } },
    { type: 'finish', runId, payload: { stepResult: { reason: 'tool-calls' } } },
  ];
  let signals = 0;
  let subscriptions = 0;
  let approvals = 0;
  const server = createServer((req, res) => {
    req.resume();
    if (req.url?.endsWith('/signals')) {
      signals++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true, runId }));
    } else if (req.url?.endsWith('/threads/subscribe')) {
      subscriptions++;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      // Only the first subscription carries the reproduced chunks; a reconnect
      // would get an empty successful stream so the old behavior ends cleanly.
      res.end(subscriptions === 1 ? chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') : '');
    } else if (req.url?.endsWith('/send-tool-approval')) {
      approvals++;
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Continuation rejected' }));
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const port = (server.address() as AddressInfo).port;
    const agent = new Agent({ baseUrl: `http://127.0.0.1:${port}`, retries: 0 }, 'test-agent');
    const scope = { threadId: 'thread-1', resourceId: 'resource-1' };
    const execute = vi.fn(async () => ({ ok: true }));

    await agent.sendSignal({
      ...scope,
      signal: { type: 'user-message', contents: 'hello' },
      ifIdle: {
        streamOptions: {
          clientTools: {
            local: {
              id: 'local',
              description: 'A local tool',
              inputSchema: z.object({}),
              execute,
            },
          },
        },
      },
    });

    const subscription = await agent.subscribeToThread(scope);
    const error = await subscription
      .processDataStream({
        onChunk: () => {},
        // A non-zero retry allowance proves the continuation failure bypasses
        // reconnect rather than merely exhausting the retry budget.
        reconnect: { maxRetries: 1, delayMs: 0 },
      })
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(error).toBeInstanceOf(MastraClientError);
    expect(error).toMatchObject({ status: 409, body: { error: 'Continuation rejected' } });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(approvals).toBe(1);
    expect(subscriptions).toBe(1);
    expect(signals).toBe(1);

    // Both the failed run's options and the thread's latest options are cleared.
    expect(agent['getSignalRuntimeOptions']({ runId })).toBeUndefined();
    expect(
      agent['getSignalRuntimeOptions']({ resourceId: scope.resourceId, threadId: scope.threadId }),
    ).toBeUndefined();
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
});
