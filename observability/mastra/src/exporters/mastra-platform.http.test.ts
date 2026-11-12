import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import { Mastra } from '@mastra/core';
import { noopLogger } from '@mastra/core/logger';
import { SpanType } from '@mastra/core/observability';
import type { FeedbackEvent, ScoreEvent, LogEvent, TracingEvent } from '@mastra/core/observability';
import { InMemoryStore, ObservabilityStorage } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observability } from '../default';
import { DefaultExporter } from './default';
import { MastraPlatformExporter } from './mastra-platform';
import type { MastraPlatformExporterConfig } from './mastra-platform';
import { MastraStorageExporter } from './mastra-storage';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function collector(hold = false, reply?: (res: ServerResponse, path: string) => void) {
  const bodies: {
    path: string;
    method: string;
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
      method: req.method!,
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
  describe.each([
    {
      name: 'storage',
      create: (maxBatchSize: number) => new MastraStorageExporter({ maxBatchWaitMs: 60_000, maxBatchSize }),
    },
    {
      name: 'storage bytes',
      create: (maxBatchSize: number) =>
        new MastraStorageExporter({ maxBatchWaitMs: 60_000, maxBatchSize, byteBatching: {} }),
    },
    {
      name: 'legacy storage',
      create: (maxBatchSize: number) => new DefaultExporter({ maxBatchWaitMs: 60_000, maxBatchSize }),
    },
  ])('$name review ordering', ({ create }) => {
    it.each(['buffered', 'resolving', 'inflight'] as const)(
      'applies review updates after a %s create without delaying remote updates',
      async scenario => {
        const receiver = await collector();
        const storage = new InMemoryStore();
        const store = (await storage.getStore('observability'))!;
        await store.createSpan({
          span: {
            traceId: 'trace',
            spanId: 'root',
            parentSpanId: null,
            name: 'root',
            spanType: SpanType.GENERIC,
            isEvent: false,
            startedAt: new Date(),
            endedAt: new Date(),
          },
        });
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        if (scenario === 'resolving') {
          const getTrace = store.getTrace.bind(store);
          store.getTrace = async args => {
            await gate;
            return getTrace(args);
          };
        }
        if (scenario === 'inflight') {
          const batchCreate = store.batchCreateFeedback.bind(store);
          store.batchCreateFeedback = async args => {
            await gate;
            return batchCreate(args);
          };
        }
        let feedbackId = '';
        const observability = new Observability({
          configs: {
            default: {
              serviceName: 'ordered-local-review',
              exporters: [
                create(scenario === 'inflight' ? 1 : 1000),
                exporter(receiver.endpoint),
                {
                  name: 'feedback-id',
                  exportTracingEvent() {},
                  onFeedbackEvent(event) {
                    feedbackId = event.feedback.feedbackId;
                  },
                  async flush() {},
                  async shutdown() {},
                },
              ],
            },
          },
        });
        new Mastra({ storage, observability, logger: false });
        cleanup.push(() => observability.shutdown());
        try {
          await observability.addFeedback({
            traceId: 'trace',
            ...(scenario === 'resolving' ? {} : { correlationContext: {} }),
            feedback: { feedbackType: 'comment', value: 'keep' },
          });
          await observability.updateFeedbackReviewStatus({ feedbackId, reviewStatus: 'reviewed' });
          await expect.poll(() => receiver.bodies.some(body => body.method === 'PATCH')).toBe(true);
        } finally {
          release();
        }
        await observability.flush();
        expect((await store.listFeedback({})).feedback).toEqual([
          expect.objectContaining({ feedbackId, value: 'keep', reviewStatus: 'reviewed' }),
        ]);
      },
    );
  });

  describe.each([
    { first: 'PATCH', second: 'PATCH' },
    { first: 'PUT', second: 'PATCH' },
    { first: 'PATCH', second: 'PUT' },
  ] as const)('$first then $second feedback ordering', ({ first, second }) => {
    const update = (
      instance: MastraPlatformExporter,
      method: 'PUT' | 'PATCH',
      feedbackId: string,
      reviewStatus: 'reviewed' | 'needs-review',
    ) => {
      if (method === 'PATCH') {
        instance.onFeedbackReviewStatusEvent({
          type: 'feedback_review_status',
          feedback: { feedbackId, reviewStatus },
        });
      } else {
        instance.onFeedbackReplacementEvent({
          type: 'feedback_replacement',
          feedback: {
            feedbackId,
            traceId: 'trace',
            timestamp: new Date('2026-11-11T12:00:00Z'),
            feedbackType: 'comment',
            value: 'keep',
            reviewStatus,
          },
        });
      }
    };
    const status = (body: { data: Record<string, any> }) => body.data.feedback?.reviewStatus ?? body.data.reviewStatus;

    it.each(['flush', 'shutdown'] as const)(
      'preserves update order across retries on %s without blocking other feedback IDs',
      async lifecycle => {
        let firstArrived!: () => void;
        const firstRequest = new Promise<void>(resolve => {
          firstArrived = resolve;
        });
        let attempts = 0;
        const receiver = await collector(false, (res, path) => {
          if (path.includes('/ordered%2Fid') && ++attempts === 1) {
            res.writeHead(503).end(
              JSON.stringify({
                code: first === 'PUT' ? 'ANCHOR_LOOKUP_UNAVAILABLE' : 'FEEDBACK_LOOKUP_UNAVAILABLE',
              }),
            );
            firstArrived();
          } else res.writeHead(204).end();
        });
        const instance = exporter(receiver.endpoint);
        update(instance, first, 'ordered/id', 'reviewed');
        await firstRequest;
        update(instance, second, 'ordered/id', 'needs-review');
        update(instance, 'PATCH', 'independent', 'reviewed');
        await instance[lifecycle]();
        const writes = receiver.bodies.filter(body => body.path.includes('/ordered%2Fid'));
        expect(writes.map(body => [body.method, status(body)])).toEqual([
          [first, 'reviewed'],
          [first, 'reviewed'],
          [second, 'needs-review'],
        ]);
        expect(writes[0]?.raw).toBe(writes[1]?.raw);
        expect(receiver.bodies[1]?.path).toContain('/independent/');
      },
    );

    it('delivers the next update after a terminal failure', async () => {
      let attempts = 0;
      const receiver = await collector(false, res => res.writeHead(++attempts === 1 ? 403 : 204).end());
      const instance = exporter(receiver.endpoint);
      update(instance, first, 'ordered/id', 'reviewed');
      update(instance, second, 'ordered/id', 'needs-review');
      await instance.flush();
      expect(receiver.bodies.map(body => [body.method, status(body)])).toEqual([
        [first, 'reviewed'],
        [second, 'needs-review'],
      ]);
    });
  });

  it.each([MastraStorageExporter, DefaultExporter])(
    'skips inherited unsupported review updates in %s',
    async StorageExporter => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      const update = store.updateFeedbackReviewStatus.bind(store);
      store.updateFeedbackReviewStatus = ObservabilityStorage.prototype.updateFeedbackReviewStatus;
      const instance = new StorageExporter();
      const observability = new Observability({
        configs: { default: { serviceName: 'unsupported-review', exporters: [instance] } },
      });
      new Mastra({ storage, observability, logger: false });
      cleanup.push(() => observability.shutdown());
      await expect(
        instance.onFeedbackReviewStatusEvent({
          type: 'feedback_review_status',
          feedback: { feedbackId: 'review', reviewStatus: 'reviewed' },
        }),
      ).resolves.toBeUndefined();
      expect((await store.listFeedback({})).feedback).toEqual([]);
      store.updateFeedbackReviewStatus = update;
      await expect(
        instance.onFeedbackReviewStatusEvent({
          type: 'feedback_review_status',
          feedback: { feedbackId: 'missing', reviewStatus: 'reviewed' },
        }),
      ).rejects.toThrow('Feedback record not found');
    },
  );

  it.each([MastraStorageExporter, DefaultExporter])(
    'sends review updates while %s is waiting on local storage',
    async StorageExporter => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      await store.createFeedback({
        feedback: {
          feedbackId: 'review',
          timestamp: new Date(),
          traceId: 'trace',
          feedbackType: 'comment',
          value: 'keep',
          feedbackUserId: 'author',
        },
      });
      const original = await store.getFeedbackById('review');
      const update = store.updateFeedbackReviewStatus.bind(store);
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      store.updateFeedbackReviewStatus = async args => {
        await gate;
        return update(args);
      };
      const otherEvents: unknown[] = [];
      const legacyEvents: unknown[] = [];
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'independent-review',
            exporters: [
              new StorageExporter(),
              exporter(receiver.endpoint),
              {
                name: 'third-party',
                exportTracingEvent() {},
                onFeedbackReviewStatusEvent(event) {
                  otherEvents.push(event);
                },
                async flush() {},
                async shutdown() {},
              },
              {
                name: 'older-exporter',
                exportTracingEvent() {},
                onFeedbackEvent(event) {
                  legacyEvents.push(event);
                },
                onFeedbackReplacementEvent(event) {
                  legacyEvents.push(event);
                },
                async flush() {},
                async shutdown() {},
              },
            ],
          },
        },
      });
      new Mastra({ storage, observability, logger: false });
      cleanup.push(() => observability.shutdown());
      try {
        await observability.updateFeedbackReviewStatus({ feedbackId: 'review', reviewStatus: 'reviewed' });
        await expect.poll(() => receiver.bodies.length, { timeout: 1500 }).toBe(1);
        expect(receiver.bodies[0]).toMatchObject({
          method: 'PATCH',
          path: '/api/observability/feedback/review/review-status',
          data: { reviewStatus: 'reviewed' },
        });
        expect((await store.getFeedbackById('review'))?.reviewStatus).toBe('needs-review');
      } finally {
        release();
      }
      await observability.flush();
      expect(await store.getFeedbackById('review')).toEqual({ ...original, reviewStatus: 'reviewed' });
      expect(otherEvents).toEqual([
        { type: 'feedback_review_status', feedback: { feedbackId: 'review', reviewStatus: 'reviewed' } },
      ]);
      expect(legacyEvents).toEqual([]);
    },
  );

  it.each(['missing', 'unsupported'] as const)(
    'delivers review updates remotely when local feedback is %s',
    async scenario => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      if (scenario === 'unsupported') Object.defineProperty(store, 'updateFeedbackReviewStatus', { value: undefined });
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'remote-review',
            exporters: [new MastraStorageExporter(), exporter(receiver.endpoint)],
          },
        },
      });
      new Mastra({ storage, observability, logger: false });
      cleanup.push(() => observability.shutdown());
      await observability.updateFeedbackReviewStatus({ feedbackId: 'remote', reviewStatus: 'reviewed' });
      await observability.flush();
      expect(receiver.bodies.map(body => [body.method, body.data])).toEqual([['PATCH', { reviewStatus: 'reviewed' }]]);
      expect((await store.listFeedback({})).feedback).toEqual([]);
    },
  );

  it.each(['flush', 'shutdown'] as const)('drains review PATCH retries with a stable body on %s', async lifecycle => {
    let attempts = 0;
    const receiver = await collector(false, res => {
      if (++attempts === 1) res.writeHead(404).end(JSON.stringify({ code: 'FEEDBACK_NOT_FOUND' }));
      else if (attempts === 2) res.writeHead(503).end(JSON.stringify({ code: 'FEEDBACK_LOOKUP_UNAVAILABLE' }));
      else res.writeHead(204).end();
    });
    const instance = exporter(receiver.endpoint, { projectId: 'project' });
    const event = {
      type: 'feedback_review_status' as const,
      feedback: { feedbackId: 'review/id', reviewStatus: 'reviewed' as const },
    };
    instance.onFeedbackReviewStatusEvent(event);
    event.feedback.feedbackId = 'changed';
    await instance[lifecycle]();
    expect(receiver.bodies).toHaveLength(3);
    for (const body of receiver.bodies) {
      expect(body).toMatchObject({
        method: 'PATCH',
        path: '/api/observability/feedback/review%2Fid/review-status',
        data: { reviewStatus: 'reviewed' },
      });
      expect(body.headers.authorization).toBe('Bearer local-test-token');
      expect(body.headers['x-mastra-project-id']).toBe('project');
      expect(body.raw).toBe(receiver.bodies[0]!.raw);
    }
    await instance.flush();
    expect(receiver.bodies).toHaveLength(3);
  });

  it.each([400, 401, 403, 404, 500, 503])('does not retry unrelated PATCH HTTP %s failures', async status => {
    const receiver = await collector(false, res => res.writeHead(status).end(JSON.stringify({ code: 'UNRELATED' })));
    const instance = exporter(receiver.endpoint);
    instance.onFeedbackReviewStatusEvent({
      type: 'feedback_review_status',
      feedback: { feedbackId: 'review', reviewStatus: 'reviewed' },
    });
    await instance.flush();
    expect(receiver.bodies).toHaveLength(1);
  });

  it('sends remote replacements while local storage is still resolving the trace', async () => {
    const receiver = await collector();
    const storage = new InMemoryStore();
    const store = (await storage.getStore('observability'))!;
    await store.createSpan({
      span: {
        traceId: 'slow-local',
        spanId: 'root',
        parentSpanId: null,
        name: 'root',
        spanType: SpanType.GENERIC,
        isEvent: false,
        startedAt: new Date(),
        endedAt: new Date(),
        tags: ['local'],
      },
    });
    const read = store.getTrace.bind(store);
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    store.getTrace = async args => {
      await gate;
      return read(args);
    };
    const legacyCreates: FeedbackEvent[] = [];
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'independent-replace',
          exporters: [
            new MastraStorageExporter(),
            exporter(receiver.endpoint),
            {
              name: 'older-exporter',
              exportTracingEvent() {},
              onFeedbackEvent(event) {
                legacyCreates.push(event);
              },
              async flush() {},
              async shutdown() {},
            },
          ],
        },
      },
    });
    new Mastra({ storage, observability, logger: false });
    cleanup.push(() => observability.shutdown());
    try {
      await observability.replaceFeedback({
        traceId: 'slow-local',
        feedback: { feedbackId: 'independent-edit', timestamp: new Date(), feedbackType: 'thumbs', value: -1 },
      });
      await expect.poll(() => receiver.bodies.length, { timeout: 1000 }).toBe(1);
      expect(receiver.bodies[0]!.method).toBe('PUT');
      expect((await store.listFeedback({})).feedback).toHaveLength(0);
    } finally {
      release();
    }
    await observability.flush();
    expect((await store.listFeedback({})).feedback).toEqual([expect.objectContaining({ value: -1, tags: ['local'] })]);
    expect(legacyCreates).toEqual([]);
  });

  it.each(['flush', 'shutdown'] as const)(
    'drains feedback PUT retries with stable identity during %s',
    async lifecycle => {
      let attempts = 0;
      const receiver = await collector(false, res => {
        if (++attempts === 1)
          res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 'TRACE_NOT_FOUND' }));
        else res.writeHead(204).end();
      });
      const instance = exporter(receiver.endpoint);
      instance.onFeedbackReplacementEvent({
        type: 'feedback_replacement',
        feedback: {
          feedbackId: 'edited/id',
          traceId: 'remote',
          timestamp: new Date('2026-11-11T12:00:00.123Z'),
          feedbackType: 'thumbs',
          value: -1,
          correlationContext: {},
          feedbackUserId: null,
          reviewStatus: 'reviewed',
        },
      });
      await instance[lifecycle]();
      expect(receiver.bodies).toHaveLength(2);
      expect(receiver.bodies.map(body => [body.method, body.path])).toEqual([
        ['PUT', '/api/observability/feedback/edited%2Fid'],
        ['PUT', '/api/observability/feedback/edited%2Fid'],
      ]);
      expect(receiver.bodies[1]!.raw).toBe(receiver.bodies[0]!.raw);
      expect(receiver.bodies[0]!.data.feedback).toMatchObject({
        feedbackId: 'edited/id',
        value: -1,
        feedbackUserId: null,
        reviewStatus: 'reviewed',
        timestamp: '2026-11-11T12:00:00.123Z',
      });
    },
  );

  it.each([MastraStorageExporter, DefaultExporter])(
    'delivers replacements independently and protects local edits from delayed creates (%s)',
    async StorageExporter => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      const local = new StorageExporter();
      const observability = new Observability({
        configs: { default: { serviceName: 'replace-test', exporters: [local, exporter(receiver.endpoint)] } },
      });
      new Mastra({ storage, observability, logger: false });
      cleanup.push(() => observability.shutdown());
      const feedback = { feedbackId: 'sdk-edit', timestamp: new Date(), feedbackType: 'thumbs', value: -1 };
      // Explicit context avoids a local trace dependency; replacement can precede a batched create.
      await observability.replaceFeedback({
        traceId: 'remote',
        correlationContext: {},
        feedback: { ...feedback, metadata: { userId: 'trace-subject' } },
      });
      await observability.flush();
      await local.onFeedbackEvent({
        type: 'feedback',
        feedback: { ...feedback, traceId: 'remote', correlationContext: {}, value: 1 },
      });
      await local.flush();
      expect((await store.listFeedback({})).feedback).toEqual([
        expect.objectContaining({ feedbackId: 'sdk-edit', value: -1, feedbackUserId: null }),
      ]);
      expect(receiver.bodies.map(body => body.method)).toEqual(['PUT']);
    },
  );

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
    expect(receiver.bodies.map(body => body.path)).toEqual(['/api/observability/scores']);
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

describe('SDK feedback and score delivery', () => {
  it.each([
    { StorageExporter: MastraStorageExporter, orphan: false },
    { StorageExporter: DefaultExporter, orphan: false },
    { StorageExporter: MastraStorageExporter, orphan: true },
    { StorageExporter: DefaultExporter, orphan: true },
  ])(
    'exports remote-only anchors independently of $StorageExporter (orphan: $orphan)',
    async ({ StorageExporter, orphan }) => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      if (orphan) {
        const store = (await storage.getStore('observability'))!;
        for (const [spanId, parentSpanId] of [
          ['unrelated-root', null],
          ['remote-span', 'missing-parent'],
        ] as const)
          await store.createSpan({
            span: {
              traceId: 'remote-trace',
              spanId,
              parentSpanId,
              name: spanId,
              spanType: SpanType.GENERIC,
              isEvent: false,
              startedAt: new Date(),
              endedAt: new Date(),
              tags: ['unrelated-tags'],
            },
          });
      }
      const platform = exporter(receiver.endpoint);
      const localExporter = new StorageExporter();
      const observability = new Observability({
        configs: { default: { serviceName: 'producer-test', exporters: [localExporter, platform] } },
      });
      const mastra = new Mastra({ logger: false, storage, observability });
      const warn = vi.fn();
      localExporter.__setLogger({ ...noopLogger, warn });
      cleanup.push(() => observability.shutdown());
      const submitted = Promise.all([
        mastra.observability.addFeedback({
          traceId: 'remote-trace',
          spanId: 'remote-span',
          feedback: { feedbackType: 'comment', value: 'actionable' },
        }),
        mastra.observability.addScore({
          traceId: 'remote-trace',
          spanId: orphan ? 'remote-span' : undefined,
          score: { scorerId: 'quality', score: 1 },
        }),
      ]);
      // Remote delivery must start while local anchor lookup is still retrying.
      await expect.poll(() => receiver.bodies.length, { timeout: 1000 }).toBe(2);
      await submitted;
      await observability.flush();
      expect(receiver.bodies.map(body => body.path).sort()).toEqual([
        '/api/observability/feedback',
        '/api/observability/scores',
      ]);
      expect(receiver.bodies.find(body => body.data.feedback)?.data.feedback).toMatchObject({
        traceId: 'remote-trace',
        spanId: 'remote-span',
        value: 'actionable',
      });
      expect(receiver.bodies.find(body => body.data.score)?.data.score).toMatchObject({
        traceId: 'remote-trace',
        scorerId: 'quality',
        score: 1,
      });
      const store = (await storage.getStore('observability'))!;
      expect((await store.listFeedback({})).feedback).toHaveLength(0);
      expect((await store.listScores({})).scores).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith('Storage export dropped because the target trace/span was not found', {
        eventType: 'feedback',
        traceId: 'remote-trace',
        spanId: 'remote-span',
      });
      expect(warn).toHaveBeenCalledWith('Storage export dropped because the target trace/span was not found', {
        eventType: 'score',
        traceId: 'remote-trace',
        spanId: orphan ? 'remote-span' : undefined,
      });
    },
    15_000,
  );
  it.each([
    { StorageExporter: MastraStorageExporter, recovers: true },
    { StorageExporter: DefaultExporter, recovers: true },
    { StorageExporter: MastraStorageExporter, recovers: false },
    { StorageExporter: DefaultExporter, recovers: false },
  ])(
    'retries failed local reads without delaying remote delivery ($StorageExporter, recovers: $recovers)',
    async ({ StorageExporter, recovers }) => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      await store.createSpan({
        span: {
          traceId: 'read-failure',
          spanId: 'root',
          parentSpanId: null,
          name: 'root',
          spanType: SpanType.GENERIC,
          isEvent: false,
          startedAt: new Date(),
          endedAt: new Date(),
          tags: ['stored-tags'],
        },
      });
      const readTrace = store.getTrace.bind(store);
      let attempts = 0;
      const failure = new Error('Storage temporarily unavailable');
      // Inject read failures into real storage; successful reads and all writes remain real.
      store.getTrace = async args => {
        attempts++;
        if (!recovers || attempts <= 2) throw failure;
        return readTrace(args);
      };
      const localExporter = new StorageExporter();
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'read-failure-test',
            exporters: [localExporter, exporter(receiver.endpoint)],
          },
        },
      });
      const mastra = new Mastra({ storage, observability, logger: false });
      const error = vi.spyOn(console, 'error');
      cleanup.push(async () => {
        error.mockRestore();
      });
      cleanup.push(() => observability.shutdown());
      await mastra.observability.addFeedback({
        traceId: 'read-failure',
        feedback: { feedbackType: 'comment', value: 'useful' },
      });
      await mastra.observability.addScore({ traceId: 'read-failure', score: { scorerId: 'quality', score: 1 } });
      await expect.poll(() => receiver.bodies.length, { timeout: 1000 }).toBe(2);
      await observability.flush();
      const feedbackRows = (await store.listFeedback({})).feedback;
      const scoreRows = (await store.listScores({})).scores;
      if (recovers) {
        expect(feedbackRows).toEqual([expect.objectContaining({ value: 'useful', tags: ['stored-tags'] })]);
        expect(scoreRows).toEqual([expect.objectContaining({ score: 1, tags: ['stored-tags'] })]);
        expect(error).not.toHaveBeenCalled();
      } else {
        expect(attempts).toBe(14); // Seven bounded attempts for each record.
        expect(feedbackRows).toHaveLength(0);
        expect(scoreRows).toHaveLength(0);
        expect(error).toHaveBeenCalledWith(expect.stringContaining(localExporter.name), failure);
      }
    },
    15_000,
  );

  it('delivers to Platform and custom exporters without attached storage', async () => {
    const receiver = await collector();
    const webhook = await collector();
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'remote-only',
          exporters: [
            exporter(receiver.endpoint),
            {
              name: 'webhook',
              exportTracingEvent: async () => {},
              onScoreEvent: async (event: ScoreEvent) => {
                await fetch(webhook.endpoint, { method: 'POST', body: JSON.stringify(event) });
              },
              onFeedbackEvent: async (event: FeedbackEvent) => {
                await fetch(webhook.endpoint, { method: 'POST', body: JSON.stringify(event) });
              },
              flush: async () => {},
              shutdown: async () => {},
            },
          ],
        },
      },
    });
    const mastra = new Mastra({ observability, logger: false });
    cleanup.push(() => observability.shutdown());
    await mastra.observability.addScore({ traceId: 'remote-only', score: { scorerId: 'quality', score: 0.8 } });
    await mastra.observability.addFeedback({
      traceId: 'remote-only',
      feedback: { feedbackType: 'comment', value: 'useful' },
    });
    await observability.shutdown();
    expect(receiver.bodies.filter(body => body.path.startsWith('/api/observability/'))).toHaveLength(2);
    expect(webhook.bodies).toHaveLength(2);
    for (const kind of ['score', 'feedback']) {
      expect(webhook.bodies.find(b => b.data[kind])!.data[kind]).toEqual(
        receiver.bodies.find(b => b.data[kind])!.data[kind],
      );
    }
  });

  it.each([
    { mode: 'provided', StorageExporter: MastraStorageExporter },
    { mode: 'resolve', StorageExporter: MastraStorageExporter },
    { mode: 'provided', StorageExporter: DefaultExporter },
    { mode: 'resolve', StorageExporter: DefaultExporter },
  ])(
    'keeps identity across local storage and remote $mode delivery ($StorageExporter)',
    async ({ mode, StorageExporter }) => {
      const receiver = await collector();
      const storage = new InMemoryStore();
      const store = (await storage.getStore('observability'))!;
      if (mode === 'resolve') {
        for (const [spanId, parentSpanId, tags] of [
          ['unrelated-root', null, ['wrong']],
          ['root', null, ['correct']],
          ['child', 'root', ['child-tag']],
        ] as const)
          await store.createSpan({
            span: {
              traceId: 'local-trace',
              spanId,
              parentSpanId,
              name: spanId,
              tags: [...tags],
              startedAt: new Date(),
              endedAt: new Date(),
              isEvent: false,
              spanType: SpanType.GENERIC,
              userId: 'span-user',
              metadata: { inherited: true },
            },
          });
      }
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'identity-test',
            exporters: [new StorageExporter(), exporter(receiver.endpoint)],
          },
        },
      });
      const mastra = new Mastra({ observability, storage, logger: false });
      cleanup.push(() => observability.shutdown());
      const context = mode === 'provided' ? { correlationContext: { tags: ['provided'], userId: 'span-user' } } : {};
      await mastra.observability.addFeedback({
        traceId: 'local-trace',
        spanId: 'child',
        ...context,
        feedback: {
          feedbackType: 'comment',
          value: 'actionable',
          feedbackUserId: 'reviewer',
          metadata: { explicit: true },
        },
      });
      await mastra.observability.addScore({
        traceId: 'local-trace',
        spanId: 'child',
        ...context,
        score: { scorerId: 'quality', score: 0.7, metadata: { explicit: true } },
      });
      await observability.flush();
      for (const [collection, field, idField] of [
        ['feedback', 'feedback', 'feedbackId'],
        ['scores', 'score', 'scoreId'],
      ] as const) {
        const rows =
          collection === 'feedback' ? (await store.listFeedback({})).feedback : (await store.listScores({})).scores;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ tags: mode === 'provided' ? ['provided'] : ['correct'], userId: 'span-user' });
        const body = receiver.bodies.find(b =>
          b.path.endsWith(mode === 'provided' ? `/ai/${collection}/publish` : `/api/observability/${collection}`),
        )!;
        const remote = mode === 'provided' ? body.data[collection][0] : body.data[field];
        expect(remote[idField]).toBe((rows[0] as any)[idField]);
        expect(remote.timestamp).toBe(rows[0]!.timestamp.toISOString());
        if (mode === 'resolve') {
          expect(remote).not.toHaveProperty('correlationContext');
          expect(remote.metadata).toEqual({ explicit: true });
          expect(rows[0]!.metadata).toEqual({ inherited: true, explicit: true });
        }
      }
    },
  );

  it('persists annotations for buffered spans during shutdown', async () => {
    const storage = new InMemoryStore();
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'buffered-trace',
          exporters: [new MastraStorageExporter({ maxBatchWaitMs: 60_000 })],
        },
      },
    });
    const mastra = new Mastra({ observability, storage, logger: false });
    cleanup.push(() => observability.shutdown());
    const root = observability.getDefaultInstance()!.startSpan({ type: SpanType.GENERIC, name: 'buffered' });
    root.end();
    await mastra.observability.addScore({ traceId: root.traceId, score: { scorerId: 'quality', score: 1 } });
    await mastra.observability.addFeedback({
      traceId: root.traceId,
      feedback: { feedbackType: 'comment', value: 'useful' },
    });
    await observability.shutdown();
    const store = (await storage.getStore('observability'))!;
    expect((await store.listScores({})).scores).toEqual([expect.objectContaining({ traceId: root.traceId, score: 1 })]);
    expect((await store.listFeedback({})).feedback).toEqual([
      expect.objectContaining({ traceId: root.traceId, value: 'useful' }),
    ]);
  });
});
