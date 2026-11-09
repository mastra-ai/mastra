import { Mastra } from '@mastra/core';
import { SpanType } from '@mastra/core/observability';
import { EntityType, InMemoryStore } from '@mastra/core/storage';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
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
}
