import { createServer } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';

describe('signal writes over HTTP', () => {
  let client: MastraClient;
  let close: () => Promise<void>;
  let received: { method?: string; path?: string; body: Record<string, any>; headers: IncomingHttpHeaders }[];
  let replies: (number | 'disconnect')[];
  let errorCode: string | undefined;
  let includeData: boolean;
  beforeEach(async () => {
    received = [];
    replies = [];
    errorCode = undefined;
    includeData = false;
    const server = createServer(async (req, res) => {
      let text = '';
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      received.push({ method: req.method, path: req.url, body, headers: req.headers });
      const status = replies.shift() ?? 200;
      if (status === 'disconnect') {
        req.socket.destroy();
        return;
      }
      res.writeHead(status, { 'content-type': 'application/json' });
      const field = body.feedback ? 'feedback' : 'score';
      const record = body[field];
      res.end(
        JSON.stringify(
          status === 200
            ? {
                success: true,
                ...(includeData
                  ? {
                      data: {
                        [`${field}Id`]: record[`${field}Id`],
                        traceId: record.traceId,
                        spanId: record.spanId ?? null,
                        timestamp: new Date(record.timestamp).toISOString(),
                      },
                    }
                  : {}),
              }
            : { code: errorCode, error: 'not ready' },
        ),
      );
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    client = new MastraClient({
      baseUrl: `http://127.0.0.1:${port}`,
      retries: 2,
      backoffMs: 5,
      maxBackoffMs: 10,
      headers: { authorization: 'Bearer exporter-token', 'x-mastra-project-id': 'project-1' },
    });
    close = () => new Promise<void>(resolve => server.close(() => resolve()));
  });
  afterEach(async () => {
    await close();
  });

  it.each(['feedback', 'score'] as const)(
    'keeps generated %s identity stable across lost responses and 500s',
    async kind => {
      replies = ['disconnect', 500, 200];
      const result =
        kind === 'feedback'
          ? await client.createFeedback({ feedback: { traceId: 'trace-1', feedbackType: 'thumbs', value: 1 } })
          : await client.createScore({ score: { traceId: 'trace-1', scorerId: 'quality', score: 0.9 } });
      expect(result).toEqual({ success: true }); // Older servers can return no data.
      expect(received).toHaveLength(3);
      const first = received[0].body;
      expect(first[kind][`${kind}Id`]).toEqual(expect.any(String));
      expect(first[kind].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(received.map(request => request.body)).toEqual([first, first, first]);
      expect(first).not.toHaveProperty('contextMode');
      expect(received[2].headers).toMatchObject({
        authorization: 'Bearer exporter-token',
        'x-mastra-project-id': 'project-1',
      });
    },
  );

  it.each(['TRACE_NOT_FOUND', 'SPAN_NOT_FOUND'])('retries only recognized anchor errors: %s', async code => {
    replies = [404, 404, 200];
    errorCode = code;
    const feedback = {
      feedbackId: 'caller-id',
      timestamp: '2026-01-01T00:00:00.123Z',
      traceId: 'trace',
      feedbackType: 'thumbs',
      value: 1,
    };
    await client.createFeedback({ contextMode: 'resolve', feedback });
    expect(received.map(request => request.body)).toEqual(Array(3).fill({ contextMode: 'resolve', feedback }));
  });

  it.each([400, 401, 403, 404, 501])('does not retry unrelated HTTP %s errors', async status => {
    replies = [status, 200];
    await expect(
      client.createScore({ score: { traceId: 'trace', scorerId: 'quality', score: 1 } }),
    ).rejects.toMatchObject({ status });
    expect(received).toHaveLength(1);
  });

  it.each(['feedback', 'score'] as const)(
    'returns the server validation error for a missing %s wrapper',
    async kind => {
      replies = [400];
      const body = { traceId: 'trace', value: 1 };
      const result =
        kind === 'feedback'
          ? // @ts-expect-error Exercise malformed requests from JavaScript callers.
            client.createFeedback(body)
          : // @ts-expect-error Exercise malformed requests from JavaScript callers.
            client.createScore(body);

      await expect(result).rejects.toMatchObject({ status: 400 });
      expect(received).toHaveLength(1);
      expect(received[0].body).toEqual(body);
    },
  );

  it.each([400, 401])('preserves HTTP %s from a custom transport after the anchor deadline', async status => {
    replies = [404, status];
    errorCode = 'TRACE_NOT_FOUND';
    let attempts = 0;
    const customClient = new MastraClient({
      ...client.options,
      retries: 0,
      fetch: async (input, init) => {
        // A custom transport may not cancel an in-flight request. Return its real
        // HTTP response after the deadline, rather than synthesizing an abort.
        if (++attempts > 1 && init?.signal && !init.signal.aborted) {
          await new Promise<void>(resolve => init.signal?.addEventListener('abort', () => resolve(), { once: true }));
        }
        return fetch(input, { ...init, signal: undefined });
      },
    });

    await expect(
      customClient.createFeedback(
        { feedback: { traceId: 'trace', feedbackType: 'thumbs', value: 1 } },
        { anchorRetryTimeoutMs: 100 },
      ),
    ).rejects.toMatchObject({ status });
    expect(received).toHaveLength(2);
  });

  it('bounds anchor retries and supports per-operation cancellation', async () => {
    replies = Array(100).fill(404);
    errorCode = 'TRACE_NOT_FOUND';
    const body = { feedback: { traceId: 'trace', feedbackType: 'thumbs', value: 1 } };
    await expect(client.createFeedback(body, { anchorRetryTimeoutMs: 30 })).rejects.toMatchObject({ status: 404 });
    expect(received.length).toBeGreaterThan(1);
    const controller = new AbortController();
    const promise = client.createFeedback(body, { signal: controller.signal });
    setTimeout(() => controller.abort(), 15);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    const attempts = received.length;
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(received).toHaveLength(attempts);
  });

  it.each(['feedback', 'score'] as const)(
    'preserves explicit provided mode and exposes %s response data',
    async kind => {
      includeData = true;
      const timestamp = '2026-01-01T01:00:00.123+01:00';
      const result =
        kind === 'feedback'
          ? await client.createFeedback({
              contextMode: 'provided',
              feedback: {
                feedbackId: 'original',
                timestamp,
                traceId: 'trace',
                feedbackType: 'thumbs',
                value: 1,
                userId: 'span-user',
                feedbackUserId: 'reviewer',
              },
            })
          : await client.createScore({
              contextMode: 'provided',
              score: {
                scoreId: 'original',
                timestamp,
                traceId: 'trace',
                scorerId: 'quality',
                score: 1,
                tags: ['provided'],
              },
            });
      expect(received[0].body.contextMode).toBe('provided');
      expect(received[0].body[kind]).toMatchObject({ [`${kind}Id`]: 'original', timestamp });
      expect(result.data).toEqual({
        [`${kind}Id`]: 'original',
        traceId: 'trace',
        spanId: null,
        timestamp: '2026-01-01T00:00:00.123Z',
      });
    },
  );

  it('sends a wrapped PUT preserving the original identity and timestamp', async () => {
    replies = [500, 200];
    const feedback = {
      feedbackId: 'id/1',
      traceId: 'trace',
      timestamp: '2026-01-01T00:00:00.123Z',
      feedbackType: 'thumbs',
      value: -1,
    };
    await client.replaceFeedback({ feedback });
    expect(received).toHaveLength(2);
    for (const request of received)
      expect(request).toMatchObject({ method: 'PUT', path: '/api/observability/feedback/id%2F1', body: { feedback } });
  });
});
