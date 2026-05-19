import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

// NOTE: The smoke fixture intentionally does NOT enable `backgroundTasks` on
// the Mastra instance. When enabled, the BackgroundTaskManager injects a
// system prompt that teaches the LLM to opt tool calls into background mode,
// which breaks deterministic agent tool-use tests. The route handler still
// responds with an empty envelope when no manager is attached.
describe('background tasks — empty state shape', () => {
  it('GET /background-tasks returns the paginated tasks envelope when disabled', async () => {
    const { status, data } = await fetchJson<any>('/api/background-tasks');
    expect(status).toBe(200);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.tasks.length).toBe(0);
    expect(data.total).toBe(0);
  });

  it('GET /background-tasks/:id returns a structured 404 for an unknown id', async () => {
    const res = await fetchApi('/api/background-tasks/does-not-exist-smoke');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toMatch(/background task not found/i);
  });
});
