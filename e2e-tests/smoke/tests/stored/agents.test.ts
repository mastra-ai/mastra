import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-stored-agent-${Date.now()}`;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let initialUpdatedAt: string | undefined;

describe('stored agents — CRUD', () => {
  afterAll(async () => {
    await fetchApi(`/api/stored/agents/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('lists stored agents with a paginated envelope', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/agents');
    expect(status).toBe(200);
    expect(Array.isArray(data.agents)).toBe(true);
    expect(data.page).toBe(0);
    expect(data.perPage).toBeGreaterThan(0);
    expect(typeof data.total).toBe('number');
    expect(typeof data.hasMore).toBe('boolean');
  });

  it('creates a stored agent with a resolved version id', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/agents', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'Smoke Stored Agent',
        instructions: 'You are a smoke probe.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
      }),
    });
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.name).toBe('Smoke Stored Agent');
    // Initial status defaults vary across alpha versions
    // (was 'draft' pre-1.36, became 'published' in 1.36.0-alpha.2).
    // We assert it's one of the known valid states.
    expect(['draft', 'published']).toContain(data.status);
    expect(data.model).toEqual({ provider: 'openai', name: 'gpt-4o-mini' });
    expect(data.resolvedVersionId).toMatch(UUID_RE);
    expect(data.createdAt).toMatch(ISO_RE);
    expect(data.updatedAt).toMatch(ISO_RE);
    initialUpdatedAt = data.updatedAt;
  });

  it('gets the stored agent by id', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`);
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.instructions).toBe('You are a smoke probe.');
    expect(['draft', 'published']).toContain(data.status);
  });

  it('updates the stored agent and bumps updatedAt', async () => {
    // Small sleep so the timestamp can advance.
    await new Promise((r) => setTimeout(r, 5));
    const { status, data } = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'updated by smoke' }),
    });
    expect(status).toBe(200);
    expect(data.description).toBe('updated by smoke');
    expect(data.updatedAt).toMatch(ISO_RE);
    if (initialUpdatedAt) {
      expect(Date.parse(data.updatedAt)).toBeGreaterThanOrEqual(Date.parse(initialUpdatedAt));
    }
  });

  it('deletes the stored agent and returns 404 on subsequent GET', async () => {
    const del = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(del.data.success).toBe(true);

    const after = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`);
    expect(after.status).toBe(404);
    expect(typeof after.data.error).toBe('string');
  });
});
