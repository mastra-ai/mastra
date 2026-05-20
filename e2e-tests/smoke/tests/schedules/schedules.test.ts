import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('schedules — list', () => {
  it('GET /schedules returns the smoke-heartbeat schedule registered by the fixture', async () => {
    const { status, data } = await fetchJson<any>('/api/schedules');
    expect(status).toBe(200);
    expect(Array.isArray(data.schedules)).toBe(true);
    expect(data.schedules.length).toBeGreaterThan(0);

    const heartbeat = data.schedules.find(
      (s: any) => s.target?.workflowId === 'scheduled-heartbeat',
    );
    expect(heartbeat).toBeDefined();
    expect(heartbeat.cron).toBe('0 0 1 1 *');
    expect(heartbeat.status).toBe('active');
    expect(heartbeat.target.type).toBe('workflow');
    expect(typeof heartbeat.nextFireAt).toBe('number');
    expect(typeof heartbeat.createdAt).toBe('number');
    expect(heartbeat.metadata?.purpose).toBe('smoke-test-schedule');
  });

  it('GET /schedules?workflowId filters by workflow', async () => {
    const { status, data } = await fetchJson<any>(
      '/api/schedules?workflowId=scheduled-heartbeat',
    );
    expect(status).toBe(200);
    expect(data.schedules.length).toBeGreaterThan(0);
    for (const s of data.schedules) {
      expect(s.target.workflowId).toBe('scheduled-heartbeat');
    }
  });

  it('GET /schedules/:scheduleId returns the schedule by id', async () => {
    const list = await fetchJson<any>('/api/schedules');
    const heartbeat = list.data.schedules.find(
      (s: any) => s.target?.workflowId === 'scheduled-heartbeat',
    );
    const { status, data } = await fetchJson<any>(`/api/schedules/${heartbeat.id}`);
    expect(status).toBe(200);
    expect(data.id).toBe(heartbeat.id);
    expect(data.cron).toBe('0 0 1 1 *');
  });

  it('GET /schedules/:scheduleId returns a structured 404 for an unknown id', async () => {
    const res = await fetchApi('/api/schedules/does-not-exist-smoke');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toMatch(/schedule not found/i);
  });
});

describe('schedules — actually fires', () => {
  // Pause the every-second tick after these tests to keep it from hammering
  // the DB for the rest of the suite (and to keep UI runs quiet too).
  afterAll(async () => {
    const list = await fetchJson<any>('/api/schedules?workflowId=scheduled-tick');
    const tick = list.data?.schedules?.find(
      (s: any) => s.target?.workflowId === 'scheduled-tick',
    );
    if (tick?.id) {
      await fetchApi(`/api/schedules/${tick.id}/pause`, { method: 'POST' }).catch(() => {});
    }
  });

  it('GET /schedules/:scheduleId/triggers shows the every-second tick workflow actually ran', async () => {
    const list = await fetchJson<any>('/api/schedules?workflowId=scheduled-tick');
    expect(list.status).toBe(200);
    const tick = list.data.schedules.find(
      (s: any) => s.target?.workflowId === 'scheduled-tick',
    );
    expect(tick, 'scheduled-tick schedule must be registered').toBeDefined();

    // Poll the triggers endpoint until the scheduler has actually published at
    // least one trigger with a successful workflow run. Scheduler tick is 1s
    // and cron is */1s, so a real fire should land within a few seconds.
    const deadline = Date.now() + 15_000;
    let publishedWithRun: any | undefined;
    while (Date.now() < deadline) {
      const res = await fetchJson<any>(`/api/schedules/${tick.id}/triggers?limit=10`);
      expect(res.status).toBe(200);
      publishedWithRun = res.data.triggers?.find(
        (t: any) => t.outcome === 'published' && t.runId && t.run?.status === 'success',
      );
      if (publishedWithRun) break;
      await new Promise(r => setTimeout(r, 500));
    }

    expect(publishedWithRun, 'scheduler did not publish a successful run within 15s').toBeDefined();
    expect(publishedWithRun.outcome).toBe('published');
    expect(typeof publishedWithRun.runId).toBe('string');
    expect(publishedWithRun.run.status).toBe('success');
  });

  it('GET /schedules surfaces lastRun after the scheduler fires', async () => {
    const deadline = Date.now() + 15_000;
    let withLastRun: any | undefined;
    while (Date.now() < deadline) {
      const res = await fetchJson<any>('/api/schedules?workflowId=scheduled-tick');
      withLastRun = res.data.schedules?.find(
        (s: any) => s.target?.workflowId === 'scheduled-tick' && s.lastRunId,
      );
      if (withLastRun?.lastRun?.status === 'success') break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(withLastRun, 'schedule did not record a lastRun within 15s').toBeDefined();
    expect(withLastRun.lastRun.status).toBe('success');
  });
});
