import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

// NOTE: The smoke fixture intentionally does not register any scheduled
// workflows. There is an upstream race where the LibSQL scheduler tick fires
// before the `mastra_schedules` table migration completes on a freshly wiped
// DB, flooding the server with SQLITE_ERROR every tick and stalling long UI
// suites. Until that is fixed upstream, we assert the empty-state shape only.
describe('schedules — empty state shape', () => {
  it('GET /schedules returns an empty list envelope when no schedules are registered', async () => {
    const { status, data } = await fetchJson<any>('/api/schedules');
    expect(status).toBe(200);
    expect(Array.isArray(data.schedules)).toBe(true);
    expect(data.schedules.length).toBe(0);
  });

  it('GET /schedules/:scheduleId returns a structured 404 for an unknown id', async () => {
    const res = await fetchApi('/api/schedules/does-not-exist-smoke');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toMatch(/schedule not found/i);
  });
});
