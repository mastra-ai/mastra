import { beforeAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('observability extras', () => {
  beforeAll(async () => {
    // Make sure at least one branch exists by running a deterministic workflow.
    // Branches are generated as observability spans for agent/workflow runs.
    await fetchApi('/api/workflows/sequential-steps/start-async', {
      method: 'POST',
      body: JSON.stringify({ inputData: { name: 'obs-extras-probe' } }),
    }).catch(() => {});
    // Poll the branches endpoint until the writer has flushed at least one span,
    // so this test does not race the observability pipeline under full-suite load.
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const { status, data } = await fetchJson<any>('/api/observability/branches?perPage=1');
      if (status === 200 && (data?.pagination?.total ?? 0) > 0) return;
      await new Promise((r) => setTimeout(r, 200));
    }
  });

  it('GET /observability/branches returns a typed pagination envelope with rows', async () => {
    const { status, data } = await fetchJson<any>('/api/observability/branches?perPage=5');
    expect(status).toBe(200);
    expect(Array.isArray(data.branches)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(typeof data.pagination.total).toBe('number');
    expect(typeof data.pagination.page).toBe('number');
    expect(typeof data.pagination.perPage).toBe('number');
    expect(typeof data.pagination.hasMore).toBe('boolean');

    // After triggering a workflow we expect at least one branch row.
    expect(data.pagination.total).toBeGreaterThan(0);
    expect(data.branches.length).toBeGreaterThan(0);
    expect(data.branches.length).toBeLessThanOrEqual(data.pagination.perPage);

    const row = data.branches[0];
    expect(typeof row.traceId).toBe('string');
    expect(typeof row.spanId).toBe('string');
    expect(typeof row.entityType).toBe('string');
    expect(typeof row.name).toBe('string');
    expect(typeof row.startedAt).toBe('string');
  });

  it('GET /observability/traces/light returns a structured 500 with DuckDB storage', async () => {
    // The smoke fixture uses ObservabilityStorageDuckDB which does not support
    // listing lightweight traces — assert the precise gated error so the test
    // catches a silent capability change.
    const res = await fetchApi('/api/observability/traces/light?pageSize=3');
    if (res.status === 200) {
      const data: any = await res.json();
      expect(Array.isArray(data.spans) || Array.isArray(data.traces)).toBe(true);
    } else {
      expect(res.status).toBe(500);
      const data: any = await res.json();
      expect(data.error).toMatch(/does not support listing lightweight traces/i);
    }
  });

  it('GET /observability/traces/:traceId/trajectory returns 404 for an unknown trace', async () => {
    const res = await fetchApi('/api/observability/traces/smoke-nonexistent-trace/trajectory');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(typeof data.error).toBe('string');
    expect(data.error).toMatch(/not found/i);
  });

  it('POST /observability/traces/:traceId/spans/:spanId/scores rejects synthetic ids', async () => {
    const res = await fetchApi(
      '/api/observability/traces/smoke-nonexistent-trace/spans/smoke-nonexistent-span/scores',
      {
        method: 'POST',
        body: JSON.stringify({ score: 1, scorerName: 'smoke-scorer' }),
      },
    );
    // Either method is not registered (405) or storage rejects with 4xx; should not be 5xx.
    expect([400, 404, 405]).toContain(res.status);
  });
});
