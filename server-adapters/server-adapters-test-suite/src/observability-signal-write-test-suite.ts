import { once } from 'node:events';
import { createServer } from 'node:http';
import { Mastra } from '@mastra/core';
import { SpanType } from '@mastra/core/observability';
import type { FeedbackEvent, ScoreEvent, ObservabilityInstance } from '@mastra/core/observability';
import { EntityType, InMemoryStore } from '@mastra/core/storage';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
import {
  Observability,
  DefaultObservabilityInstance,
  MastraStorageExporter,
  MastraPlatformExporter,
} from '@mastra/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

export interface ObservabilitySignalWriteTestConfig {
  startServer: (mastra: Mastra) => Promise<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
    close: () => Promise<void>;
  }>;
}

/** Shared HTTP contract for feedback/score writes, backed by real in-memory storage. */
export function createObservabilitySignalWriteTestSuite({ startServer }: ObservabilitySignalWriteTestConfig) {
  describe.each(['feedback', 'scores'] as const)('%s HTTP writes', collection => {
    let server: Awaited<ReturnType<typeof startServer>>;
    let store: ObservabilityStorage;
    let trustedScope: Record<string, unknown>;
    let allowAccess: boolean;
    let authorLookupFails: boolean;

    const isFeedback = collection === 'feedback';
    const field = isFeedback ? 'feedback' : 'score';
    const idField = isFeedback ? 'feedbackId' : 'scoreId';
    const payload = isFeedback ? { feedbackType: 'thumbs', value: 1 } : { scorerId: 'accuracy', score: 0.9 };
    const path = `/api/observability/${collection}`;

    beforeEach(async () => {
      trustedScope = {};
      allowAccess = true;
      authorLookupFails = false;
      const storage = new InMemoryStore();
      store = (await storage.getStore('observability'))!;
      server = await startServer(
        new Mastra({
          storage,
          logger: false,
          server: {
            auth: {
              authenticateToken: async () => ({}),
              ...{
                getCurrentUser: async () => null,
                getUser: async (id: string) => {
                  if (authorLookupFails) throw new Error('Directory unavailable');
                  return id === 'author-1'
                    ? { id, name: 'Alice', email: 'alice@example.com', secret: 'private' }
                    : null;
                },
              },
              authorize: async (_path, _method, _user, c) => {
                for (const [key, value] of Object.entries(trustedScope)) c.get('requestContext').set(key, value);
                return allowAccess;
              },
            },
          },
        }),
      );
    });
    afterEach(async () => {
      await server?.close();
    });

    const post = (record: Record<string, unknown>, contextMode?: unknown) =>
      server.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer test-token' },
        body: JSON.stringify({ [field]: record, contextMode }),
      });
    const list = async () => {
      const response = await server.request(path, { headers: { authorization: 'Bearer test-token' } });
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<'feedback' | 'scores', Record<string, unknown>[]>;
      return body[collection];
    };

    if (collection === 'feedback') {
      const original = {
        feedbackId: 'edit',
        traceId: 'trace-123',
        timestamp: '2026-11-11T12:00:00.123Z',
        feedbackType: 'thumbs',
        value: 1,
      };
      const put = (feedback: Record<string, unknown>, contextMode?: string) =>
        server.request(`${path}/edit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', authorization: 'Bearer test-token' },
          body: JSON.stringify({ feedback, contextMode }),
        });
      it.each([{ feedbackId: 'other' }, { timestamp: undefined }, { traceId: ' ' }])(
        'rejects malformed replacements: %j',
        async change => {
          expect((await put({ ...original, ...change })).status).toBe(400);
          expect(await list()).toHaveLength(0);
        },
      );
      it.each([{ traceId: 'different' }, { timestamp: '2026-11-12T12:00:00.123Z' }])(
        'rejects changing feedback identity: %j',
        async change => {
          await post(original);
          expect((await put({ ...original, ...change })).status).toBe(409);
          expect(await list()).toEqual([
            expect.objectContaining({ value: 1, traceId: original.traceId, timestamp: original.timestamp }),
          ]);
        },
      );
      it('returns 404 instead of overwriting feedback from another tenant', async () => {
        await post({ ...original, organizationId: 'other' });
        trustedScope.organizationId = 'trusted';
        expect((await put({ ...original, organizationId: 'other', value: -1 })).status).toBe(404);
        expect((await store.getFeedbackById(original.feedbackId))?.value).toBe(1);
      });
      it('uses the authenticated feedback author and clears omitted replacement fields', async () => {
        await post({ ...original, comment: 'old', feedbackUserId: 'old-author' });
        trustedScope.mastra__user = { id: 'reviewer' };
        expect((await put({ ...original, value: -1, feedbackUserId: 'spoofed' })).status).toBe(200);
        const saved = await store.getFeedbackById(original.feedbackId);
        expect(saved).toMatchObject({ value: -1, feedbackUserId: 'reviewer' });
        expect(saved?.comment ?? null).toBeNull();
      });
      it('returns 501 with an older storage package and keeps existing feedback', async () => {
        await post(original);
        Object.defineProperty(store, 'replaceFeedback', { value: undefined });
        expect((await put({ ...original, value: -1 })).status).toBe(501);
        expect((await store.getFeedbackById(original.feedbackId))?.value).toBe(1);
      });
      it('allows replacement before create and requires the local anchor in resolve mode', async () => {
        expect((await put({ ...original, value: -1 }, 'resolve')).status).toBe(404);
        expect((await put({ ...original, value: -1 }, 'provided')).status).toBe(200);
        expect((await post(original)).status).toBe(200);
        expect((await store.getFeedbackById(original.feedbackId))?.value).toBe(-1);
      });
      it('replaces feedback without allowing a delayed create to undo the edit', async () => {
        const original = {
          feedbackId: 'replace-me',
          traceId: 'trace-123',
          timestamp: '2026-11-11T12:00:00.123Z',
          feedbackType: 'comment',
          value: 'original',
          comment: 'old comment',
        };
        expect((await post(original)).status).toBe(200);
        const response = await server.request('/api/observability/feedback/replace-me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', authorization: 'Bearer test-token' },
          body: JSON.stringify({ feedback: { ...original, value: 'edited', comment: null } }),
        });
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toMatchObject({
          success: true,
          data: { feedbackId: 'replace-me', timestamp: original.timestamp },
        });
        expect((await post(original)).status).toBe(200);
        expect(await list()).toEqual([
          expect.objectContaining({ feedbackId: 'replace-me', value: 'edited', comment: null }),
        ]);
      });
    }

    describe('single-record reads', () => {
      it('returns the persisted record with its identity and timestamp', async () => {
        const id = 'single-record';
        const timestamp = '2026-11-05T12:00:00.000Z';
        const identity = { traceId: 'trace-123', timestamp: new Date(timestamp) };
        if (isFeedback) {
          await store.createFeedback({ feedback: { ...identity, feedbackId: id, feedbackType: 'thumbs', value: 1 } });
        } else {
          await store.createScore({ score: { ...identity, scoreId: id, scorerId: 'accuracy', score: 0.9 } });
        }
        const response = await server.request(`${path}/${id}`, {
          headers: { authorization: 'Bearer test-token' },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          [field]: { ...payload, [idField]: id, traceId: 'trace-123', timestamp },
        });
      });

      it('returns null for a missing record', async () => {
        const response = await server.request(`${path}/missing`, {
          headers: { authorization: 'Bearer test-token' },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ [field]: null });
      });

      it('denies reads when authorization rejects access', async () => {
        allowAccess = false;
        const response = await server.request(`${path}/private-record`, {
          headers: { authorization: 'Bearer test-token' },
        });
        expect(response.status).toBe(403);
      });
    });

    if (isFeedback) {
      describe('single-record feedback enrichment and compatibility', () => {
        it.each(['resolved', 'missing', 'failed', 'anonymous'])(
          'returns feedback with %s author lookup consistently with the list',
          async scenario => {
            authorLookupFails = scenario === 'failed';
            await store.createFeedback({
              feedback: {
                feedbackId: 'with-author',
                traceId: 'trace-123',
                timestamp: new Date('2026-11-05T12:00:00.000Z'),
                feedbackType: 'thumbs',
                value: 1,
                feedbackUserId: scenario === 'anonymous' ? null : scenario === 'missing' ? 'deleted-user' : 'author-1',
              },
            });
            const response = await server.request(`${path}/with-author`, {
              headers: { authorization: 'Bearer test-token' },
            });
            expect(response.status).toBe(200);
            const { feedback } = (await response.json()) as { feedback: Record<string, unknown> };
            expect(feedback).toEqual((await list())[0]);
            expect(feedback.feedbackId).toBe('with-author');
            if (scenario === 'resolved') {
              expect(feedback.author).toEqual({ id: 'author-1', name: 'Alice', email: 'alice@example.com' });
            } else {
              expect(feedback).not.toHaveProperty('author');
            }
          },
        );

        it('returns 501 when an older Core store lacks single-feedback reads', async () => {
          // Reproduce the method surface of Core versions predating this endpoint.
          Object.defineProperty(store, 'getFeedbackById', { value: undefined, configurable: true });
          const response = await server.request(`${path}/existing-id`, {
            headers: { authorization: 'Bearer test-token' },
          });
          expect(response.status).toBe(501);
          expect(await response.json()).toMatchObject({ error: expect.stringContaining('single-feedback reads') });
        });
      });
    }

    it.each([undefined, null, '', ' ', '\t\n'])(
      'rejects traceId %j without persisting a record (OBS-788)',
      async traceId => {
        // Observe the real store without replacing it: validation must run before storage.
        const create = vi.spyOn(store, isFeedback ? 'createFeedback' : 'createScore');
        for (const spanId of [undefined, 'span-without-trace']) {
          const response = await post({ ...payload, traceId, spanId });
          expect(response.status, await response.clone().text()).toBe(400);
        }
        expect(create).not.toHaveBeenCalled();
        expect(await list()).toEqual([]);
      },
    );

    it.each([undefined, 'span-123'])(
      'persists a trace with spanId %j and preserves the write contract',
      async spanId => {
        const before = Date.now();
        // No trace is stored: this change requires an ID, not a trace-existence lookup.
        for (const id of [undefined, 'caller-id']) {
          const response = await post({ ...payload, traceId: 'trace-123', spanId, [idField]: id });
          expect(response.status, await response.clone().text()).toBe(200);
          expect(await response.json()).toMatchObject({
            success: true,
            data: { traceId: 'trace-123', spanId: spanId ?? null, timestamp: expect.any(String) },
          });
        }
        const rows = await list();
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map(row => row[idField])).size).toBe(2);
        expect(rows.some(row => row[idField] === 'caller-id')).toBe(true);
        for (const row of rows) {
          expect(row).toMatchObject({ ...payload, traceId: 'trace-123' });
          expect(row.spanId ?? null).toBe(spanId ?? null);
          expect(row[idField]).toEqual(expect.any(String));
          expect(String(row[idField]).length).toBeGreaterThan(0);
          expect(new Date(String(row.timestamp)).getTime()).toBeGreaterThanOrEqual(before);
          expect(new Date(String(row.timestamp)).getTime()).toBeLessThanOrEqual(Date.now());
        }
      },
    );

    const writeSpan = async (
      spanId: string,
      parentSpanId: string | null = null,
      overrides: Partial<CreateSpanRecord> = {},
    ) => {
      await store.createSpan({
        span: {
          traceId: 'trace-123',
          spanId,
          parentSpanId,
          name: spanId,
          spanType: SpanType.GENERIC,
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
          entityType: EntityType.AGENT,
          entityId: spanId,
          userId: 'span-user',
          tags: parentSpanId ? ['child-tag'] : ['root-tag'],
          metadata: { inherited: true, override: 'stored', userId: 'metadata-user' },
          ...overrides,
        },
      });
    };

    it.each([undefined, 'provided'])('uses supplied context without lookup in mode %j', async contextMode => {
      const lookup = vi.spyOn(store, 'getTrace');
      const spanLookup = vi.spyOn(store, 'getSpan');
      const timestamp = '2026-01-01T01:00:00.123456+01:00';
      const response = await post(
        {
          ...payload,
          traceId: 'absent',
          spanId: 'absent',
          timestamp,
          [idField]: 'stable-id',
          userId: 'span-user',
          tags: ['provided'],
        },
        contextMode,
      );
      expect(response.status, await response.clone().text()).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: {
          [idField]: 'stable-id',
          traceId: 'absent',
          spanId: 'absent',
          timestamp: '2026-01-01T00:00:00.123Z',
        },
      });
      expect(lookup).not.toHaveBeenCalled();
      expect(spanLookup).not.toHaveBeenCalled();
      const [row] = await list();
      expect(row).toMatchObject({ userId: 'span-user', tags: ['provided'], timestamp: '2026-01-01T00:00:00.123Z' });
      expect(row).not.toHaveProperty('contextMode');
      expect(row).not.toHaveProperty('rootEntityId');
      if (isFeedback) expect(row!.feedbackUserId).toBeNull();
    });

    it('rejects unsupported modes and invalid timestamps before writing', async () => {
      for (const contextMode of ['automatic', null, false]) {
        expect((await post({ ...payload, traceId: 'trace-123' }, contextMode)).status).toBe(400);
      }
      for (const timestamp of ['invalid', null, 123]) {
        expect((await post({ ...payload, traceId: 'trace-123', timestamp })).status).toBe(400);
      }
      expect(await list()).toEqual([]);
    });

    it('requires the root before accepting a resolved annotation, even if the target exists', async () => {
      await writeSpan('child', 'missing-root');
      for (const spanId of [undefined, 'child', 'missing-target']) {
        const response = await post({ ...payload, traceId: 'trace-123', spanId, tags: ['supplied'] }, 'resolve');
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ code: 'TRACE_NOT_FOUND' });
      }
      await writeSpan('root');
      const response = await post({ ...payload, traceId: 'trace-123', spanId: 'missing-target' }, 'resolve');
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'SPAN_NOT_FOUND' });
      expect(await list()).toEqual([]);
    });

    it.each([undefined, 'child'])('resolves root tags and target context for span %j', async spanId => {
      await writeSpan('root');
      await writeSpan('child', 'root');
      const response = await post(
        {
          ...payload,
          traceId: 'trace-123',
          spanId,
          userId: 'spoofed',
          tags: ['spoofed'],
          entityId: 'spoofed',
          feedbackUserId: 'reviewer',
          metadata: { override: 'request' },
        },
        'resolve',
      );
      expect(response.status, await response.clone().text()).toBe(200);
      const [row] = await list();
      expect(row).toMatchObject({
        userId: 'span-user',
        tags: ['root-tag'],
        entityId: spanId ?? 'root',
        rootEntityId: 'root',
        metadata: { inherited: true, override: 'request', userId: 'metadata-user' },
      });
      if (spanId) expect(row!.parentEntityId).toBe('root');
      if (isFeedback) expect(row!.feedbackUserId).toBe('reviewer');
      expect(row).not.toHaveProperty('contextMode');
    });

    it.each([undefined, 'older-root', 'child'])(
      'uses the target ancestor root, or latest root without a target, for span %j',
      async spanId => {
        await writeSpan('older-root', null, { tags: ['older'] });
        await writeSpan('parent', 'older-root');
        await writeSpan('child', 'parent');
        await writeSpan('newer-root', null, {
          endedAt: new Date('2026-01-01T00:00:02Z'),
          tags: ['newer'],
        });
        const response = await post({ ...payload, traceId: 'trace-123', spanId }, 'resolve');
        expect(response.status, await response.clone().text()).toBe(200);
        const [row] = await list();
        expect(row).toMatchObject({
          rootEntityId: spanId ? 'older-root' : 'newer-root',
          tags: spanId ? ['older'] : ['newer'],
          entityId: spanId ?? 'newer-root',
        });
        if (spanId === 'child') expect(row!.parentEntityId).toBe('parent');
      },
    );

    it.each(['missing', 'cycle'] as const)('rejects a target with a %s ancestor chain', async chain => {
      await writeSpan('unrelated-root');
      await writeSpan('child', 'parent');
      await writeSpan('parent', chain === 'cycle' ? 'child' : 'missing-root');
      const response = await post({ ...payload, traceId: 'trace-123', spanId: 'child' }, 'resolve');
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'TRACE_NOT_FOUND' });
      expect(await list()).toEqual([]);
    });

    it('enforces trusted organization scope and authenticated feedback attribution', async () => {
      trustedScope = { organizationId: 'trusted-org', mastra__user: { id: 'authenticated-reviewer' } };
      const response = await post(
        {
          ...payload,
          traceId: 'absent',
          organizationId: 'spoofed-org',
          feedbackUserId: 'spoofed-author',
          userId: 'span-user',
        },
        'provided',
      );
      expect(response.status, await response.clone().text()).toBe(200);
      const [row] = await list();
      expect(row).toMatchObject({ organizationId: 'trusted-org', userId: 'span-user' });
      if (isFeedback) expect(row!.feedbackUserId).toBe('authenticated-reviewer');
      await writeSpan('root'); // This root is outside the authenticated organization.
      const resolved = await post({ ...payload, traceId: 'trace-123', organizationId: 'trusted-org' }, 'resolve');
      expect(resolved.status).toBe(404);
      expect(await resolved.json()).toMatchObject({ code: 'TRACE_NOT_FOUND' });
    });

    it.each([
      { field: 'organizationId', contextKey: 'organizationId' },
      { field: 'resourceId', contextKey: 'mastra__resourceId' },
    ] as const)('does not let a caller override trusted $field during resolution', async ({ field, contextKey }) => {
      trustedScope = { [contextKey]: 'trusted' };
      await writeSpan('trusted-root', null, { [field]: 'trusted' });
      await writeSpan('foreign-root', null, { [field]: 'foreign' });
      const rejected = await post(
        { ...payload, traceId: 'trace-123', spanId: 'foreign-root', [field]: 'foreign' },
        'resolve',
      );
      expect(rejected.status).toBe(404);
      expect(await rejected.json()).toMatchObject({ code: 'SPAN_NOT_FOUND' });
      expect(await list()).toEqual([]);

      const accepted = await post(
        { ...payload, traceId: 'trace-123', spanId: 'trusted-root', [field]: 'foreign' },
        'resolve',
      );
      expect(accepted.status, await accepted.clone().text()).toBe(200);
      expect(await list()).toEqual([
        expect.objectContaining({ [field]: 'trusted', entityId: 'trusted-root', rootEntityId: 'trusted-root' }),
      ]);
    });

    it('allows self-hosted resolution without configured tenant scope', async () => {
      await writeSpan('root', null, { organizationId: 'stored-org', resourceId: 'stored-resource' });
      const response = await post(
        { ...payload, traceId: 'trace-123', organizationId: 'caller-org', resourceId: 'caller-resource' },
        'resolve',
      );
      expect(response.status, await response.clone().text()).toBe(200);
      expect(await list()).toEqual([
        expect.objectContaining({ organizationId: 'stored-org', resourceId: 'stored-resource', rootEntityId: 'root' }),
      ]);
    });

    it('still reads historical feedback and scores with no trace', async () => {
      const timestamp = new Date();
      if (isFeedback) {
        await store.createFeedback({
          feedback: { feedbackId: 'historical', timestamp, traceId: null, feedbackType: 'thumbs', value: 1 },
        });
      } else {
        await store.createScore({
          score: { scoreId: 'historical', timestamp, traceId: null, scorerId: 'accuracy', score: 0.9 },
        });
      }
      expect(await list()).toEqual([expect.objectContaining({ [idField]: 'historical', traceId: null })]);
    });
  });
  describe.each(['feedback', 'scores'] as const)('%s HTTP export delivery', collection => {
    it.each(['flush', 'shutdown'] as const)(
      'returns HTTP success before a custom exporter completes and drains delivery on %s',
      async lifecycle => {
        const accepted: (ScoreEvent | FeedbackEvent)[] = [];
        const flushed: (ScoreEvent | FeedbackEvent)[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        const receiver = createServer(async (req, res) => {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (req.url === '/accept') {
            accepted.push(body);
            await gate;
          } else flushed.push(...body);
          res.writeHead(204).end();
        });
        receiver.listen(0, '127.0.0.1');
        await once(receiver, 'listening');
        const address = receiver.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const endpoint = `http://127.0.0.1:${address.port}`;
        const buffered: (ScoreEvent | FeedbackEvent)[] = [];
        const deliver = async (event: ScoreEvent | FeedbackEvent) => {
          await fetch(`${endpoint}/accept`, { method: 'POST', body: JSON.stringify(event) });
          buffered.push(event);
        };
        const flush = async () => {
          if (buffered.length)
            await fetch(`${endpoint}/flush`, { method: 'POST', body: JSON.stringify(buffered.splice(0)) });
        };
        const delegate = new DefaultObservabilityInstance({
          name: 'custom',
          serviceName: 'slow-custom-export',
          exporters: [
            {
              name: 'http-buffer',
              exportTracingEvent: async () => {},
              onScoreEvent: deliver,
              onFeedbackEvent: deliver,
              flush,
              shutdown: flush,
            },
          ],
        });
        // A real implementation using composition, rather than inheriting BaseObservabilityInstance.
        const custom: ObservabilityInstance = {
          getConfig: () => delegate.getConfig(),
          getExporters: () => delegate.getExporters(),
          getSpanOutputProcessors: () => delegate.getSpanOutputProcessors(),
          getLogger: () => delegate.getLogger(),
          getBridge: () => delegate.getBridge(),
          startSpan: options => delegate.startSpan(options),
          rebuildSpan: cached => delegate.rebuildSpan(cached),
          __setLogger: logger => delegate.__setLogger(logger),
          flush: () => delegate.flush(),
          shutdown: () => delegate.shutdown(),
        };
        const observability = new Observability({});
        observability.registerInstance('custom', custom, true);
        const storage = new InMemoryStore();
        const mastra = new Mastra({ storage, observability, logger: false });
        const server = await startServer(mastra);
        const isFeedback = collection === 'feedback';
        const field = isFeedback ? 'feedback' : 'score';
        const idField = isFeedback ? 'feedbackId' : 'scoreId';
        try {
          const response = await server.request(`/api/observability/${collection}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
            body: JSON.stringify({
              contextMode: 'provided',
              [field]: {
                [idField]: 'slow-export',
                traceId: 'local-trace',
                ...(isFeedback ? { feedbackType: 'comment', value: 'useful' } : { scorerId: 'quality', score: 1 }),
              },
            }),
          });
          expect(response.status, await response.clone().text()).toBe(200);
          await expect.poll(() => accepted.length).toBe(1);
          const store = (await storage.getStore('observability'))!;
          const rows = isFeedback ? (await store.listFeedback({})).feedback : (await store.listScores({})).scores;
          expect(rows).toEqual([expect.objectContaining({ [idField]: 'slow-export' })]);
          let completed = false;
          const draining = observability[lifecycle]().then(() => {
            completed = true;
          });
          await new Promise(resolve => setTimeout(resolve, 25));
          expect(completed).toBe(false);
          expect(flushed).toHaveLength(0);
          release();
          await draining;
          expect(flushed).toEqual(accepted);
          expect(flushed).toHaveLength(1);
        } finally {
          release();
          await observability.shutdown();
          await server.close();
          receiver.closeAllConnections();
          await new Promise<void>(resolve => receiver.close(() => resolve()));
        }
      },
    );

    it.each(
      [
        { contextMode: 'provided', authenticated: true, emptyContext: false },
        { contextMode: 'resolve', authenticated: true, emptyContext: false },
        { contextMode: 'provided', authenticated: false, emptyContext: false },
        { contextMode: 'provided', authenticated: false, emptyContext: true },
      ].flatMap(testCase =>
        (collection === 'feedback' ? ['POST', 'PUT'] : ['POST']).map(method => ({ ...testCase, method })),
      ),
    )(
      'persists and exports the same $method $contextMode record (authenticated: $authenticated, empty context: $emptyContext) without a second storage write',
      async ({ contextMode, authenticated, emptyContext, method }) => {
        const received: { path: string; method: string; body: Record<string, any> }[] = [];
        const receiver = createServer(async (req, res) => {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          received.push({ path: req.url!, method: req.method!, body: JSON.parse(Buffer.concat(chunks).toString()) });
          res.writeHead(204).end();
        });
        receiver.listen(0, '127.0.0.1');
        await once(receiver, 'listening');
        const address = receiver.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const storage = new InMemoryStore();
        const store = (await storage.getStore('observability'))!;
        const isFeedback = collection === 'feedback';
        const field = isFeedback ? 'feedback' : 'score';
        const idField = isFeedback ? 'feedbackId' : 'scoreId';
        const batch = vi.spyOn(store, isFeedback ? 'batchCreateFeedback' : 'batchCreateScores');
        const observability = new Observability({
          configs: {
            default: {
              serviceName: 'http-create-test',
              exporters: [
                new MastraStorageExporter(),
                new MastraPlatformExporter({
                  endpoint: `http://127.0.0.1:${address.port}`,
                  accessToken: 'test',
                  resolveFromEnv: false,
                }),
              ],
            },
          },
        });
        const mastra = new Mastra({
          storage,
          observability,
          logger: false,
          server: {
            auth: {
              authenticateToken: async () => ({}),
              authorize: async (_path, _method, _user, c) => {
                if (!emptyContext) c.get('requestContext').set('organizationId', 'trusted-org');
                if (authenticated) c.get('requestContext').set('mastra__user', { id: 'reviewer' });
                return true;
              },
            },
          },
        });
        const server = await startServer(mastra);
        try {
          if (contextMode === 'resolve')
            await store.createSpan({
              span: {
                traceId: 'http-trace',
                spanId: 'root',
                parentSpanId: null,
                name: 'root',
                spanType: SpanType.AGENT_RUN,
                isEvent: false,
                startedAt: new Date(),
                endedAt: new Date(),
                organizationId: 'trusted-org',
                userId: 'span-user',
                tags: ['stored-tag'],
                metadata: { inherited: true },
              },
            });
          const timestamp = '2026-11-11T10:00:00.123Z';
          const response = await server.request(
            `/api/observability/${collection}${method === 'PUT' ? '/http-record' : ''}`,
            {
              method,
              headers: { 'Content-Type': 'application/json', authorization: 'Bearer test' },
              body: JSON.stringify({
                contextMode,
                [field]: {
                  [idField]: 'http-record',
                  timestamp,
                  traceId: 'http-trace',
                  ...(!emptyContext
                    ? { organizationId: 'untrusted-org', userId: 'span-user', tags: ['provided-tag'] }
                    : {}),
                  metadata: { explicit: true, userId: 'metadata-user' },
                  ...(isFeedback
                    ? {
                        feedbackType: 'comment',
                        value: 'actionable',
                        feedbackUserId: authenticated ? 'spoofed' : null,
                        reviewStatus: 'reviewed',
                      }
                    : { scorerId: 'quality', score: 0.9 }),
                },
              }),
            },
          );
          expect(response.status, await response.clone().text()).toBe(200);
          expect(await response.json()).toMatchObject({ success: true, data: { [idField]: 'http-record', timestamp } });
          await observability.shutdown();
          const rows = isFeedback ? (await store.listFeedback({})).feedback : (await store.listScores({})).scores;
          expect(rows).toHaveLength(1);
          expect(batch).not.toHaveBeenCalled();
          const expectedContext = emptyContext
            ? {}
            : {
                organizationId: 'trusted-org',
                userId: 'span-user',
                tags: [contextMode === 'resolve' ? 'stored-tag' : 'provided-tag'],
              };
          expect(rows[0]).toMatchObject({
            [idField]: 'http-record',
            timestamp: new Date(timestamp),
            ...expectedContext,
          });
          const expectedPath =
            method === 'PUT' ? '/api/observability/feedback/http-record' : `/ai/${collection}/publish`;
          const writes = received.filter(item => item.path === expectedPath);
          expect(writes).toHaveLength(1);
          expect(writes[0]!.method).toBe(method);
          if (method === 'POST') expect(writes[0]!.body[collection]).toHaveLength(1);
          const exported = method === 'PUT' ? writes[0]!.body.feedback : writes[0]!.body[collection][0];
          expect(exported).toMatchObject({
            [idField]: 'http-record',
            timestamp,
            traceId: 'http-trace',
            correlationContext: expectedContext,
            metadata: { explicit: true },
          });
          if (emptyContext) expect(exported.correlationContext).toEqual({});
          if (contextMode === 'resolve') expect(exported.metadata).toMatchObject({ inherited: true });
          if (isFeedback) {
            expect(rows[0]).toMatchObject({
              feedbackUserId: authenticated ? 'reviewer' : null,
              reviewStatus: 'reviewed',
            });
            expect(exported).toMatchObject({
              feedbackUserId: authenticated ? 'reviewer' : null,
              reviewStatus: 'reviewed',
            });
            expect(exported).not.toHaveProperty('userId');
          }
        } finally {
          await observability.shutdown();
          await server.close();
          receiver.closeAllConnections();
          await new Promise<void>(resolve => receiver.close(() => resolve()));
        }
      },
    );
  });
}
