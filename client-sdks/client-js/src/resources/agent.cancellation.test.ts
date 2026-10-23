import type { Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';

// COR-1489: a per-call abort must stop execution, not merely drop the HTTP observer.
describe('stream execution cancellation over HTTP', () => {
  let server: Server;
  let baseUrl: string;
  let stream: ServerResponse;
  let runId: string;
  let aborts: string[];
  let acknowledged: boolean;
  let attemptsBeforeAck: number;
  let abortStatus: number;
  let firstChunk: boolean;
  let hangAbort: boolean;
  let starts: number;
  let holdHeaders: boolean;

  beforeEach(async () => {
    aborts = [];
    acknowledged = false;
    attemptsBeforeAck = 1;
    abortStatus = 200;
    firstChunk = false;
    hangAbort = false;
    starts = 0;
    holdHeaders = false;
    runId = '';
    server = createServer(async (req, res) => {
      if (req.url?.endsWith('/abort')) {
        aborts.push(decodeURIComponent(req.url.split('/').at(-2)!));
        if (hangAbort) return;
        acknowledged = aborts.length >= attemptsBeforeAck;
        res.writeHead(abortStatus, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ aborted: acknowledged }));
        return;
      }
      starts++;
      let body = '';
      for await (const chunk of req) body += chunk;
      runId = JSON.parse(body).runId;
      stream = res;
      if (holdHeaders) return;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.flushHeaders();
      if (firstChunk) res.write(`data: ${JSON.stringify({ type: 'start', runId, from: 'AGENT', payload: {} })}\n\n`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    stream?.end();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  const methods = [
    'stream',
    'streamUntilIdle',
    'resumeStream',
    'resumeStreamUntilIdle',
    'approveToolCall',
    'declineToolCall',
  ] as const;
  function start(
    method: (typeof methods)[number],
    signal?: AbortSignal,
    clientSignal?: AbortSignal,
    suppliedRunId?: string,
  ) {
    const agent = new MastraClient({ baseUrl, retries: 0, abortSignal: clientSignal }).getAgent('agent');
    const options = { abortSignal: signal, runId: suppliedRunId ?? 'resume-run', toolCallId: 'tool' };
    switch (method) {
      case 'stream':
        return agent.stream('hello', { abortSignal: signal, runId: suppliedRunId });
      case 'streamUntilIdle':
        return agent.streamUntilIdle('hello', { abortSignal: signal, runId: suppliedRunId });
      case 'resumeStream':
        return agent.resumeStream({}, options);
      case 'resumeStreamUntilIdle':
        return agent.resumeStreamUntilIdle({}, options);
      case 'approveToolCall':
        return agent.approveToolCall(options);
      case 'declineToolCall':
        return agent.declineToolCall(options);
    }
  }

  for (const method of methods) {
    it(`${method} rejects an already-aborted signal without starting execution`, async () => {
      const ac = new AbortController();
      ac.abort();
      await expect(start(method, ac.signal)).rejects.toMatchObject({ name: 'AbortError' });
      expect(starts).toBe(0);
      expect(aborts).toEqual([]);
    });

    it(`${method} cancels while waiting for response headers`, async () => {
      holdHeaders = true;
      const ac = new AbortController();
      const response = start(method, ac.signal);
      const rejected = expect(response).rejects.toMatchObject({ name: 'AbortError' });
      await expect.poll(() => runId).not.toBe('');
      ac.abort();
      await rejected;
      expect(acknowledged).toBe(true);
      expect(aborts).toEqual([runId]);
    });

    it.each([false, true])(`${method} cancels execution with first chunk=%s`, async chunk => {
      firstChunk = chunk;
      const ac = new AbortController();
      const response = await start(method, ac.signal);
      const reader = response.body!.getReader();
      if (chunk) await reader.read();
      ac.abort();
      await expect.poll(() => acknowledged).toBe(true);
      expect(aborts).toEqual([runId]);
      expect(runId).toEqual(expect.any(String));
      await reader.cancel().catch(() => {});
    });
  }

  it('preserves caller run IDs and retries until registration is acknowledged', async () => {
    attemptsBeforeAck = 3;
    const ac = new AbortController();
    const response = await start('stream', ac.signal, undefined, 'caller-run');
    ac.abort();
    await expect.poll(() => acknowledged).toBe(true);
    expect(aborts).toEqual(['caller-run', 'caller-run', 'caller-run']);
    await response.body!.cancel().catch(() => {});
  });

  it.each([404, 501])('falls back to transport cancellation once for unsupported endpoints (%s)', async status => {
    abortStatus = status;
    const ac = new AbortController();
    const response = await start('stream', ac.signal);
    ac.abort();
    await expect.poll(() => aborts.length).toBe(1);
    await expect(response.body!.getReader().read()).rejects.toMatchObject({ name: 'AbortError' });
    expect(aborts).toHaveLength(1);
  });

  it.each(['body', 'client'] as const)('%s cancellation only detaches', async kind => {
    const ac = new AbortController();
    const response = await start('stream', undefined, ac.signal);
    if (kind === 'body') await response.body!.cancel();
    else {
      ac.abort();
      await expect(response.body!.getReader().read()).rejects.toBeDefined();
    }
    expect(aborts).toEqual([]);
  });

  it.each([false, true])(
    'bounds execution cancellation when the endpoint hangs=%s',
    async hangs => {
      hangAbort = hangs;
      attemptsBeforeAck = Infinity;
      const ac = new AbortController();
      const response = await start('stream', ac.signal);
      const reading = response.body!.getReader().read();
      ac.abort();
      await expect(reading).rejects.toBeDefined();
      expect(aborts.length).toBeGreaterThan(0);
      const count = aborts.length;
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(aborts).toHaveLength(count);
    },
    13_000,
  );

  it('stops registration retries when the observer is cancelled', async () => {
    attemptsBeforeAck = Infinity;
    const ac = new AbortController();
    const response = await start('stream', ac.signal);
    ac.abort();
    await expect.poll(() => aborts.length).toBeGreaterThan(0);
    await response.body!.cancel().catch(() => {});
    const count = aborts.length;
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(aborts).toHaveLength(count);
  });
});
