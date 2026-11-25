import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';
import type { ProcessAgentThreadStreamOptions } from '../types';

const half = { type: 'text-delta', runId: 'run-1', from: 'AGENT', payload: { id: 'text-1', text: 'Half' } };
const history = {
  type: 'thread-history',
  runId: '',
  from: 'AGENT',
  payload: { messages: [], hasMore: false, activeRunId: null },
};
const sse = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;

// A page following a thread loses its stream when the phone locks or the network drops: the connection breaks
// mid-stream while the run goes on on the server. Following again, it asks for the stored history to catch up.
describe('following a thread again after its stream broke', () => {
  let server: Server;
  let baseUrl: string;
  let bodies: unknown[];
  let answers: Array<(response: ServerResponse) => void>;

  beforeEach(async () => {
    bodies = [];
    answers = [];
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      bodies.push(JSON.parse(body));
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      answers.shift()?.(response);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  // The first stream writes a word of the reply, then its connection breaks; the next one sends what it is given.
  const givenStreamThatBreaks = (...next: unknown[][]) => {
    answers.push(response => response.write(sse(half), () => response.socket?.destroy()));
    for (const chunks of next) answers.push(response => response.end(chunks.map(sse).join('')));
  };

  const follow = async (reconnect: ProcessAgentThreadStreamOptions<true>['reconnect']) => {
    const chunks: unknown[] = [];
    const subscription = await new MastraClient({ baseUrl, retries: 0 })
      .getAgent('assistant')
      .subscribeToThread({ resourceId: 'user-1', threadId: 'thread-1', withRunStatus: true });
    await subscription.processDataStream({ onChunk: chunk => void chunks.push(chunk), reconnect });
    return chunks;
  };

  it('asks for the stored history when it follows the thread again, if told to', async () => {
    givenStreamThatBreaks([history]);

    const chunks = await follow({ maxRetries: 1, delayMs: 0, withInitialHistory: true });

    expect(chunks).toEqual([half, history]);
    expect(bodies).toEqual([
      { resourceId: 'user-1', threadId: 'thread-1', withRunStatus: true },
      { resourceId: 'user-1', threadId: 'thread-1', withInitialHistory: true, withRunStatus: true },
    ]);
  });

  it('asks for the page of history it is told to', async () => {
    givenStreamThatBreaks([history]);

    await follow({ maxRetries: 1, delayMs: 0, withInitialHistory: { perPage: 10 } });

    expect(bodies[1]).toEqual({
      resourceId: 'user-1',
      threadId: 'thread-1',
      withInitialHistory: { perPage: 10 },
      withRunStatus: true,
    });
  });

  it('follows the thread again with the same request when not told to ask for history', async () => {
    givenStreamThatBreaks([half]);

    const chunks = await follow({ maxRetries: 1, delayMs: 0 });

    expect(chunks).toEqual([half, half]);
    expect(bodies).toEqual([
      { resourceId: 'user-1', threadId: 'thread-1', withRunStatus: true },
      { resourceId: 'user-1', threadId: 'thread-1', withRunStatus: true },
    ]);
  });
});
