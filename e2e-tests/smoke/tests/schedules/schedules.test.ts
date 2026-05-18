import { describe, expect, it } from 'vitest';
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
