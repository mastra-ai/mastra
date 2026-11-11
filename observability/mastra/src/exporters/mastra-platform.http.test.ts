import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import type { FeedbackEvent, ScoreEvent, LogEvent, TracingEvent } from '@mastra/core/observability';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraPlatformExporter } from './mastra-platform';
import type { MastraPlatformExporterConfig } from './mastra-platform';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function collector(hold = false, reply?: (res: ServerResponse, path: string) => void) {
  const bodies: {
    path: string;
    bytes: number;
    data: Record<string, any>;
    headers: IncomingHttpHeaders;
    raw: string;
  }[] = [];
  const responses: ServerResponse[] = [];
  let active = 0;
  let peak = 0;
  const server = createServer(async (req, res) => {
    active++;
    peak = Math.max(peak, active);
    res.on('finish', () => active--);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    bodies.push({
      path: req.url!,
      bytes: body.length,
      data: JSON.parse(body.toString()),
      headers: req.headers,
      raw: body.toString(),
    });
    responses.push(res);
    if (!hold) {
      if (reply) reply(res, req.url!);
      else res.writeHead(204).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    bodies,
    get peak() {
      return peak;
    },
    release() {
      hold = false;
      for (const res of responses) if (!res.writableEnded) res.writeHead(204).end();
    },
  };
}

function log(id: number, text = '😀é漢'.repeat(60)): LogEvent {
  return { type: 'log', log: { logId: `log-${id}`, timestamp: new Date(), level: 'info', message: text } } as LogEvent;
}

function exporter(endpoint: string, overrides: Partial<MastraPlatformExporterConfig> = {}) {
  const config = {
    accessToken: 'local-test-token',
    resolveFromEnv: false,
    endpoint,
    maxBatchWaitMs: 60_000,
    maxRetries: 1,
    byteBatching: { maxBatchBytes: 1800, maxConcurrentUploads: 2, uploadTimeoutMs: 2000 },
    ...overrides,
  };
  const instance = new MastraPlatformExporter(config);
  cleanup.push(() => instance.shutdown());
  return instance;
}

describe('Platform uploads over HTTP', () => {
  it('flushes UTF-8 payloads at the byte threshold without losing or duplicating records', async () => {
    const receiver = await collector();
    const instance = exporter(receiver.endpoint);
    for (let i = 0; i < 10; i++) await instance.onLogEvent(log(i));
    await instance.flush();
    expect(receiver.bodies.length).toBeGreaterThan(1);
    expect(receiver.bodies.filter(body => body.bytes >= 1800)).toHaveLength(3);
    expect(receiver.bodies.flatMap(body => body.data.logs!.map(record => record.logId)).sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `log-${i}`).sort(),
    );
  });

  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'limits concurrent uploads when the collector holds responses open (run %i)',
    async () => {
      const receiver = await collector(true);
      const instance = exporter(receiver.endpoint, { maxBatchSize: 1 });
      try {
        for (let i = 0; i < 10; i++) await instance.onLogEvent(log(i));
        await expect.poll(() => receiver.bodies.length).toBeGreaterThanOrEqual(2);
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(receiver.peak).toBe(2);
      } finally {
        receiver.release();
      }
      await instance.flush();
      expect(receiver.bodies.flatMap(body => body.data.logs!).length).toBe(10);
    },
  );

  it('retains every queued record behind slow uploads and drains concurrent flush callers', async () => {
    const receiver = await collector(true);
    const instance = exporter(receiver.endpoint, {
      maxBatchSize: 1,
      byteBatching: { maxBatchBytes: 1800, maxConcurrentUploads: 2, uploadTimeoutMs: 2000 },
    });
    let completed = false;
    let pending = 0;
    let drain: Promise<void[]>;
    try {
      for (let i = 0; i < 100; i++) {
        await instance.onLogEvent(log(i));
      }
      const stats = instance.getByteBatchingStats()!;
      pending = stats.pendingBytes;
      expect(pending).toBeGreaterThan(3600);
      drain = Promise.all([instance.flush(), instance.flush()]).then(result => {
        completed = true;
        return result;
      });
      await expect.poll(() => receiver.bodies.length).toBe(2);
      expect(completed).toBe(false);
    } finally {
      receiver.release();
    }
    await drain!;
    const received = receiver.bodies.flatMap(body => body.data.logs!);
    expect(received.length).toBe(100);
    expect(new Set(received.map(record => record.logId)).size).toBe(received.length);
    expect(receiver.bodies.reduce((total, body) => total + body.bytes, 0)).toBe(pending);
    expect(instance.getByteBatchingStats()!.pendingBytes).toBe(0);
    expect(instance.getByteBatchingStats()!.activeUploads).toBe(0);
    await instance.onLogEvent(log(100));
    await instance.flush();
    expect(receiver.bodies.at(-1)!.data.logs![0].logId).toBe('log-100');
  });

  it('sends oversized records intact and reports serialization errors', async () => {
    const receiver = await collector();
    const instance = exporter(receiver.endpoint);
    await instance.onLogEvent(log(1, 'x'.repeat(1800)));
    const invalid = log(2);
    invalid.log.data = { unsupported: 1n };
    await expect(instance.onLogEvent(invalid)).rejects.toThrow();
    await instance.onLogEvent(log(3));
    await instance.flush();
    expect(receiver.bodies.flatMap(body => body.data.logs!.map(record => record.logId))).toEqual(['log-1', 'log-3']);
    expect(receiver.bodies[0]!.data.logs![0].message).toBe('x'.repeat(1800));
    expect(instance.getByteBatchingStats()).toMatchObject({
      pendingBytes: 0,
    });
  });

  it('counts envelope and UTF-8 bytes at the exact single-record boundary', async () => {
    const receiver = await collector();
    const event = log(1);
    const bytes = Buffer.byteLength(JSON.stringify({ logs: [event.log] }));
    const instance = exporter(receiver.endpoint, { byteBatching: { maxBatchBytes: bytes } });
    await instance.onLogEvent(event);
    await instance.flush();
    expect(receiver.bodies.map(body => body.bytes)).toEqual([bytes]);
    const larger = { ...event, log: { ...event.log, message: event.log.message + 'x' } };
    await instance.onLogEvent(larger);
    await instance.flush();
    expect(receiver.bodies.map(body => body.bytes)).toEqual([bytes, bytes + 1]);
  });

  it('flushes partial batches on the wait timer and freezes records at admission', async () => {
    const receiver = await collector();
    const instance = exporter(receiver.endpoint, { maxBatchWaitMs: 20 });
    const event = log(1, 'before');
    await instance.onLogEvent(event);
    event.log.message = 'after';
    await expect.poll(() => receiver.bodies.length).toBe(1);
    expect(receiver.bodies[0]!.data.logs![0].message).toBe('before');
  });

  it('routes all five signals and drains partial batches on shutdown', async () => {
    const receiver = await collector();
    const instance = exporter(receiver.endpoint);
    await instance.onTracingEvent({
      type: 'span_ended',
      exportedSpan: {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'model',
        type: 'model_step',
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: {},
        input: 'prompt',
        output: 'answer',
      },
    } as TracingEvent);
    await instance.onLogEvent(log(1));
    await instance.onMetricEvent({
      type: 'metric',
      metric: { metricId: 'metric-1', timestamp: new Date(), name: 'test', value: 1, labels: {} },
    });
    await instance.onScoreEvent({
      type: 'score',
      score: {
        scoreId: 'score-1',
        timestamp: new Date(),
        scorerId: 'test',
        traceId: 'trace-1',
        score: 1,
        correlationContext: {},
      },
    });
    await instance.onFeedbackEvent({
      type: 'feedback',
      feedback: {
        feedbackId: 'feedback-1',
        timestamp: new Date(),
        feedbackType: 'thumbs',
        feedbackSource: 'user',
        traceId: 'trace-1',
        value: 'up',
        correlationContext: {},
      },
    });
    await instance.shutdown();
    expect(receiver.bodies.map(body => body.path).sort()).toEqual(
      ['spans', 'logs', 'metrics', 'scores', 'feedback'].map(signal => `/ai/${signal}/publish`).sort(),
    );
    expect(receiver.bodies).toHaveLength(5);
    expect(receiver.bodies.find(body => body.data.spans)?.data.spans![0]).toMatchObject({
      spanId: 'span-1',
      input: 'prompt',
      output: 'answer',
    });
    expect(instance.getByteBatchingStats()!.pendingBytes).toBe(0);
  });

  it.each([401, 402])('drops queued telemetry after collector status %i', async status => {
    const receiver = await collector(false, res => res.writeHead(status).end());
    const instance = exporter(receiver.endpoint, {
      maxBatchSize: 1,
      byteBatching: { maxBatchBytes: 1800, maxConcurrentUploads: 1 },
    });
    for (let i = 0; i < 10; i++) await instance.onLogEvent(log(i));
    await instance.flush();
    expect(receiver.bodies.length).toBe(1);
    expect(instance.getByteBatchingStats()!.pendingBytes).toBe(0);
    await instance.onLogEvent(log(11));
    await instance.flush();
    expect(receiver.bodies.length).toBe(1);
  });

  it('times out stalled uploads, frees their budget and finishes shutdown', async () => {
    const receiver = await collector(true);
    const instance = exporter(receiver.endpoint, {
      maxBatchSize: 1,
      byteBatching: { maxBatchBytes: 1800, maxConcurrentUploads: 1, uploadTimeoutMs: 100 },
    });
    await instance.onLogEvent(log(1));
    await instance.onLogEvent(log(2));
    await instance.shutdown();
    expect(receiver.bodies.length).toBe(2);
    expect(instance.getByteBatchingStats()).toMatchObject({ pendingBytes: 0, activeUploads: 0 });
    receiver.release();
  });

  it('retries the same bounded body while retaining one upload slot and its byte budget', async () => {
    let attempts = 0;
    const receiver = await collector(false, res => res.writeHead(++attempts === 1 ? 503 : 204).end());
    const instance = exporter(receiver.endpoint, {
      maxBatchSize: 1,
      maxRetries: 2,
      byteBatching: { maxBatchBytes: 1800, maxConcurrentUploads: 1, uploadTimeoutMs: 5000 },
    });
    await instance.onLogEvent(log(1));
    const drain = instance.flush();
    await expect.poll(() => receiver.bodies.length).toBe(1);
    expect(instance.getByteBatchingStats()).toMatchObject({
      activeUploads: 1,
      pendingBytes: receiver.bodies[0]!.bytes,
    });
    await drain;
    expect(receiver.bodies).toHaveLength(2);
    expect(receiver.bodies[1]).toEqual(receiver.bodies[0]);
    expect(instance.getByteBatchingStats()).toMatchObject({ activeUploads: 0, pendingBytes: 0 });
  });

  it('preserves count batching when byte mode is omitted', async () => {
    const receiver = await collector();
    const instance = exporter(receiver.endpoint, { byteBatching: undefined });
    for (let i = 0; i < 10; i++) await instance.onLogEvent(log(i));
    await instance.flush();
    expect(receiver.bodies.length).toBe(1);
    expect(receiver.bodies[0]!.bytes).toBeGreaterThan(1800);
    expect(instance.getByteBatchingStats()).toBeUndefined();
  });

  it.each([
    { maxBatchBytes: 0 },
    { maxBatchBytes: NaN },
    { maxBatchBytes: Infinity },
    { maxBatchBytes: 1800, maxConcurrentUploads: 0 },
    { maxBatchBytes: 1800, maxConcurrentUploads: 1.5 },
    { maxBatchBytes: 1800, uploadTimeoutMs: 2 ** 31 },
  ])('rejects invalid byte limits: %j', byteBatching => {
    expect(() => new MastraPlatformExporter({ accessToken: 'local', resolveFromEnv: false, byteBatching })).toThrow();
  });
});

function feedback(correlationContext?: FeedbackEvent['feedback']['correlationContext']): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      feedbackId: 'feedback-1',
      traceId: 'trace-1',
      spanId: 'span-1',
      timestamp: new Date('2026-11-11T10:00:00.123Z'),
      feedbackType: 'comment',
      value: 'actionable',
      feedbackSource: 'user',
      feedbackUserId: 'author-1',
      correlationContext,
    },
  };
}
function score(correlationContext?: ScoreEvent['score']['correlationContext']): ScoreEvent {
  return {
    type: 'score',
    score: {
      scoreId: 'score-1',
      traceId: 'trace-1',
      timestamp: new Date('2026-11-11T10:00:00.123Z'),
      scorerId: 'scorer-1',
      score: 1,
      scoreSource: 'user',
      correlationContext,
    },
  };
}

describe.each([false, true])('Platform context resolution (byte batching: %s)', byteBatching => {
  function setup(endpoint: string, overrides: Partial<MastraPlatformExporterConfig> = {}) {
    return exporter(endpoint, { ...(!byteBatching ? { byteBatching: undefined } : {}), ...overrides });
  }

  it('sends unresolved records immediately and keeps supplied context on the collector path', async () => {
    const receiver = await collector();
    const instance = setup(receiver.endpoint, { projectId: 'project-1' });
    await instance.onFeedbackEvent(feedback());
    await instance.onScoreEvent(score());
    await expect.poll(() => receiver.bodies.length).toBe(2);
    await instance.onFeedbackEvent(feedback({}));
    await instance.onScoreEvent(score({}));
    await instance.flush();
    const writes = receiver.bodies.filter(body => body.path.startsWith('/api/'));
    expect(writes.map(body => body.path).sort()).toEqual(['/api/observability/feedback', '/api/observability/scores']);
    for (const body of writes) {
      expect(body.headers.authorization).toBe('Bearer local-test-token');
      expect(body.headers['x-mastra-project-id']).toBe('project-1');
    }
    expect(writes.find(body => body.data.feedback)?.data.feedback).toEqual(
      JSON.parse(JSON.stringify(feedback().feedback)),
    );
    expect(writes.find(body => body.data.score)?.data.score).toEqual(JSON.parse(JSON.stringify(score().score)));
    expect(
      receiver.bodies
        .filter(body => body.path.includes('/publish'))
        .map(body => body.path)
        .sort(),
    ).toEqual(['/projects/project-1/ai/feedback/publish', '/projects/project-1/ai/scores/publish']);
    await instance.flush();
    expect(receiver.bodies).toHaveLength(4);
  });

  it.each([
    [404, 'TRACE_NOT_FOUND'],
    [404, 'SPAN_NOT_FOUND'],
    [503, 'ANCHOR_LOOKUP_UNAVAILABLE'],
  ])('drains stable retries after %i %s during shutdown', async (status, code) => {
    let attempts = 0;
    const receiver = await collector(false, (res, path) => {
      if (path.startsWith('/api/') && attempts++ === 0)
        res.writeHead(status, { 'Retry-After': '0' }).end(JSON.stringify({ code }));
      else res.writeHead(204).end();
    });
    const instance = setup(receiver.endpoint);
    const event = feedback();
    await instance.onFeedbackEvent(event);
    event.feedback.value = 'mutated after export';
    await instance.shutdown();
    expect(receiver.bodies).toHaveLength(2);
    expect(receiver.bodies[0]!.raw).toBe(receiver.bodies[1]!.raw);
    expect(receiver.bodies[1]!.data.feedback.value).toBe('actionable');
    await instance.flush();
    expect(receiver.bodies).toHaveLength(2);
  });

  it.each([400, 401, 403, 404, 413, 429, 500, 503])('drops terminal HTTP %i without retries', async status => {
    const receiver = await collector(false, res => res.writeHead(status).end(JSON.stringify({ code: 'OTHER_ERROR' })));
    const instance = setup(receiver.endpoint);
    await instance.onScoreEvent(score());
    await instance.flush();
    await instance.flush();
    expect(receiver.bodies).toHaveLength(1);
  });

  it('drops records without context or traceId', async () => {
    const receiver = await collector();
    const instance = setup(receiver.endpoint);
    const event = feedback();
    delete event.feedback.traceId;
    await instance.onFeedbackEvent(event);
    const scoreEvent = score();
    scoreEvent.score.traceId = '   ';
    await instance.onScoreEvent(scoreEvent);
    await instance.flush();
    expect(receiver.bodies).toHaveLength(0);
  });

  it('continues resolved writes while collector quota is exhausted', async () => {
    const receiver = await collector(false, (res, path) => {
      if (path.endsWith('/publish')) res.writeHead(402).end('{}');
      else res.writeHead(204).end();
    });
    const instance = setup(receiver.endpoint);
    await instance.onLogEvent(log(1));
    await instance.flush();
    await instance.onFeedbackEvent(feedback());
    await instance.onScoreEvent(score());
    await instance.shutdown();
    expect(receiver.bodies.map(body => body.path).sort()).toEqual([
      '/ai/logs/publish',
      '/api/observability/feedback',
      '/api/observability/scores',
    ]);
  });

  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'drains batches added during an active resolved write (run %i)',
    async () => {
      const receiver = await collector(true);
      const instance = setup(receiver.endpoint);
      await instance.onFeedbackEvent(feedback());
      let finished = false;
      const flushing = instance.flush().then(() => {
        finished = true;
      });
      try {
        await expect.poll(() => receiver.bodies.length).toBe(1);
        await instance.onLogEvent(log(1));
        expect(finished).toBe(false);
      } finally {
        receiver.release();
        await flushing;
      }
      expect(receiver.bodies.map(body => body.path).sort()).toEqual([
        '/ai/logs/publish',
        '/api/observability/feedback',
      ]);
    },
  );

  it('flushes buffered telemetry when a resolved write arrives', async () => {
    const receiver = await collector();
    const instance = setup(receiver.endpoint);
    await instance.onTracingEvent({
      type: 'span_ended',
      exportedSpan: {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'agent',
        type: 'agent_run',
        startTime: new Date(),
        endTime: new Date(),
        isEvent: false,
        isRootSpan: true,
        attributes: {},
      },
    } as TracingEvent);
    await instance.onFeedbackEvent(feedback());
    await expect.poll(() => receiver.bodies.length).toBe(2);
    expect(receiver.bodies.map(body => body.path).sort()).toEqual(['/ai/spans/publish', '/api/observability/feedback']);
    await instance.shutdown();
  });
});

describe('Resolved record delivery boundaries', () => {
  it('uses each configured endpoint origin and project-scoped URL for API-key requests', async () => {
    const feedbackReceiver = await collector();
    const scoreReceiver = await collector();
    const instance = exporter(feedbackReceiver.endpoint, {
      accessToken: 'api-key',
      projectId: 'project-1',
      feedbackEndpoint: `${feedbackReceiver.endpoint}/prefix/projects/project-2/ai/feedback/publish`,
      scoresEndpoint: `${scoreReceiver.endpoint}/prefix/projects/project-2/ai/scores/publish`,
    });
    await instance.onFeedbackEvent(feedback());
    await instance.onScoreEvent(score());
    await instance.onFeedbackEvent(feedback({}));
    await instance.onScoreEvent(score({}));
    await instance.shutdown();
    for (const [receiver, kind] of [
      [feedbackReceiver, 'feedback'],
      [scoreReceiver, 'scores'],
    ] as const) {
      expect(receiver.bodies).toHaveLength(2);
      expect(receiver.bodies.map(body => body.path).sort()).toEqual([
        `/api/observability/${kind}`,
        `/prefix/projects/project-2/ai/${kind}/publish`,
      ]);
      const direct = receiver.bodies.find(body => body.path.startsWith('/api/'))!;
      expect(direct.headers.authorization).toBe('Bearer api-key');
      expect(direct.headers['x-mastra-project-id']).toBe('project-2');
    }
  });

  it('stops after six missing-anchor attempts and releases the record', async () => {
    const receiver = await collector(false, res => res.writeHead(404).end(JSON.stringify({ code: 'SPAN_NOT_FOUND' })));
    const instance = exporter(receiver.endpoint);
    await instance.onScoreEvent(score());
    await instance.shutdown();
    expect(receiver.bodies).toHaveLength(6);
    expect(new Set(receiver.bodies.map(body => body.raw)).size).toBe(1);
    await instance.flush();
    expect(receiver.bodies).toHaveLength(6);
  }, 20_000);

  it('bounds stalled responses and long Retry-After waits during shutdown', async () => {
    const receiver = await collector(true);
    const instance = exporter(receiver.endpoint);
    await instance.onFeedbackEvent(feedback());
    const unavailable = await collector(false, res =>
      res.writeHead(503, { 'Retry-After': '3000000' }).end(JSON.stringify({ code: 'ANCHOR_LOOKUP_UNAVAILABLE' })),
    );
    const retrying = exporter(unavailable.endpoint);
    await retrying.onScoreEvent(score());
    const started = Date.now();
    await Promise.all([instance.shutdown(), retrying.shutdown()]);
    expect(Date.now() - started).toBeLessThan(32_000);
    expect(receiver.bodies).toHaveLength(1);
    expect(unavailable.bodies).toHaveLength(1);
    await Promise.all([instance.flush(), retrying.flush()]);
    expect(receiver.bodies).toHaveLength(1);
    expect(unavailable.bodies).toHaveLength(1);
  }, 35_000);

  it('does not retry broken network responses', async () => {
    const receiver = await collector(false, res => res.destroy());
    const instance = exporter(receiver.endpoint);
    await instance.onFeedbackEvent(feedback());
    await instance.shutdown();
    expect(receiver.bodies).toHaveLength(1);
  });

  it('honors Retry-After before delivering the same record again', async () => {
    const receivedAt: number[] = [];
    const receiver = await collector(false, res => {
      receivedAt.push(Date.now());
      if (receivedAt.length === 1)
        res.writeHead(503, { 'Retry-After': '1' }).end(JSON.stringify({ code: 'ANCHOR_LOOKUP_UNAVAILABLE' }));
      else res.writeHead(201).end();
    });
    const instance = exporter(receiver.endpoint);
    await instance.onScoreEvent(score());
    await instance.flush();
    expect(receivedAt).toHaveLength(2);
    expect(receivedAt[1]! - receivedAt[0]!).toBeGreaterThanOrEqual(990);
    expect(receiver.bodies[0]!.raw).toBe(receiver.bodies[1]!.raw);
  });
});
