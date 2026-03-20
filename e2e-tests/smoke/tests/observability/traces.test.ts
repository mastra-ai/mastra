import { describe, it, expect, beforeAll } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

/**
 * Poll the traces endpoint until at least `minSpans` spans are available.
 * Handles both the exporter flush delay and test execution ordering.
 */
async function waitForSpans(minSpans = 1, maxAttempts = 20, intervalMs = 500): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await fetchJson<any>('/api/observability/traces?page=0&perPage=100');
    if (data.spans?.length >= minSpans) {
      return data;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Expected at least ${minSpans} spans within ${maxAttempts * intervalMs}ms, but none appeared`);
}

describe('observability traces', () => {
  let tracesData: any;

  // Poll until the DefaultExporter has flushed spans from other test files.
  beforeAll(async () => {
    tracesData = await waitForSpans(3);
  }, 15000);

  describe('list traces', () => {
    it('should return spans with pagination', async () => {
      const { status, data } = await fetchJson<any>('/api/observability/traces?page=0&perPage=10');

      expect(status).toBe(200);
      expect(data.pagination.page).toBe(0);
      expect(data.pagination.perPage).toBe(10);
      expect(data.pagination.total).toBeGreaterThan(0);
      expect(typeof data.pagination.hasMore).toBe('boolean');
      expect(data.spans.length).toBeLessThanOrEqual(10);
      expect(data.spans.length).toBeGreaterThan(0);
    });

    it('should return spans with expected shape', async () => {
      const { data } = await fetchJson<any>('/api/observability/traces?page=0&perPage=1');
      const span = data.spans[0];

      expect(span.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(span.spanId).toMatch(/^[a-f0-9]{16}$/);
      expect(span.name.length).toBeGreaterThan(0);
      expect(span.spanType.length).toBeGreaterThan(0);
      expect(typeof span.startedAt).toBe('string');
      expect(new Date(span.startedAt).getTime()).not.toBeNaN();
      expect(span.serviceName).toSatisfy(
        (v: any) => typeof v === 'string' || v === null,
      );
    });

    it('should contain workflow spans from other tests', async () => {
      const workflowSpans = tracesData.spans.filter((s: any) => s.spanType === 'workflow_run');
      expect(workflowSpans.length, 'expected at least one workflow_run span from other tests').toBeGreaterThan(0);

      const wf = workflowSpans[0];
      expect(wf.entityType).toBe('workflow_run');
      expect(wf.entityId.length).toBeGreaterThan(0);
      expect(wf.name).toMatch(/^workflow run: '.+'$/);
    });

    it('should include successful workflow spans with timing', async () => {
      const successSpans = tracesData.spans.filter(
        (s: any) => s.spanType === 'workflow_run' && s.status === 'success',
      );
      expect(successSpans.length, 'expected at least one successful workflow_run span').toBeGreaterThan(0);

      const span = successSpans[0];
      expect(typeof span.startedAt).toBe('string');
      expect(typeof span.endedAt).toBe('string');
      expect(new Date(span.endedAt).getTime()).toBeGreaterThanOrEqual(new Date(span.startedAt).getTime());
    });

    it('should support pagination', async () => {
      // Verify enough spans exist in a fresh fetch before testing pagination
      const { data: fresh } = await fetchJson<any>('/api/observability/traces?page=0&perPage=100');
      expect(fresh.pagination.total).toBeGreaterThanOrEqual(3);

      const page0 = await fetchJson<any>('/api/observability/traces?page=0&perPage=2');
      const page1 = await fetchJson<any>('/api/observability/traces?page=1&perPage=2');

      expect(page0.data.spans).toHaveLength(2);
      expect(page1.data.spans.length).toBeGreaterThan(0);

      // Pages should return different spans
      const ids0 = page0.data.spans.map((s: any) => s.spanId);
      const ids1 = page1.data.spans.map((s: any) => s.spanId);
      const overlap = ids0.filter((id: string) => ids1.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('get trace by ID', () => {
    it('should return all spans for a trace', async () => {
      const traceId = tracesData.spans[0].traceId;

      const { status, data } = await fetchJson<any>(`/api/observability/traces/${traceId}`);

      expect(status).toBe(200);
      expect(data.traceId).toBe(traceId);
      expect(data.spans.length).toBeGreaterThan(0);

      // All spans should share the same traceId and have full shape
      for (const span of data.spans) {
        expect(span.traceId).toBe(traceId);
      }
      const span = data.spans[0];
      expect(span.spanId).toMatch(/^[a-f0-9]{16}$/);
      expect(span.name.length).toBeGreaterThan(0);
      expect(typeof span.startedAt).toBe('string');
    });

    it('should return 404 for non-existent trace', async () => {
      const res = await fetchApi('/api/observability/traces/does-not-exist-trace-id');

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('not found');
    });
  });
});
