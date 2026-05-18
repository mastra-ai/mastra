import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-versioned-agent-${Date.now()}`;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let v1Id: string;
let v2Id: string;

describe('stored agent versions — full lifecycle', () => {
  beforeAll(async () => {
    const created = await fetchJson<any>('/api/stored/agents', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'Smoke Versioned Agent',
        instructions: 'v1',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
      }),
    });
    expect(created.status).toBe(200);
  });

  afterAll(async () => {
    await fetchApi(`/api/stored/agents/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('creates an initial version with changeMessage "Initial version"', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/agents/${TEST_ID}/versions`);
    expect(status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.versions).toHaveLength(1);
    const v = data.versions[0];
    expect(v.agentId).toBe(TEST_ID);
    expect(v.versionNumber).toBe(1);
    expect(v.changeMessage).toBe('Initial version');
    expect(v.instructions).toBe('v1');
    expect(v.id).toMatch(UUID_RE);
    expect(v.createdAt).toMatch(ISO_RE);
    expect(Array.isArray(v.changedFields)).toBe(true);
    // Initial version records every field as changed.
    expect(v.changedFields).toEqual(expect.arrayContaining(['name', 'instructions', 'model']));
    v1Id = v.id;
  });

  it('auto-saves a new version with each PATCH', async () => {
    const patched = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ instructions: 'v2 updated' }),
    });
    expect(patched.status).toBe(200);
    expect(patched.data.instructions).toBe('v2 updated');

    const after = await fetchJson<any>(`/api/stored/agents/${TEST_ID}/versions`);
    expect(after.data.total).toBe(2);
    expect(after.data.versions).toHaveLength(2);
    const v2 = after.data.versions.find((v: any) => v.versionNumber === 2);
    expect(v2).toBeDefined();
    expect(v2.changeMessage).toBe('Auto-saved after edit');
    expect(v2.instructions).toBe('v2 updated');
    expect(v2.changedFields).toContain('instructions');
    v2Id = v2.id;
  });

  it('GET /versions/:versionId returns a single version', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/agents/${TEST_ID}/versions/${v1Id}`);
    expect(status).toBe(200);
    expect(data.id).toBe(v1Id);
    expect(data.versionNumber).toBe(1);
    expect(data.instructions).toBe('v1');
  });

  it('POST /versions/:versionId/activate sets activeVersionId', async () => {
    const { status, data } = await fetchJson<any>(
      `/api/stored/agents/${TEST_ID}/versions/${v1Id}/activate`,
      { method: 'POST' },
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Version 1 is now active');
    expect(typeof data.activeVersionId).toBe('string');

    const reread = await fetchJson<any>(`/api/stored/agents/${TEST_ID}`);
    expect(reread.status).toBe(200);
    // The agent now reports an activeVersionId pointing at the activated version's record.
    expect(reread.data.activeVersionId).toBe(data.activeVersionId);
  });

  it('POST /versions/:versionId/restore appends a new version with the restored content', async () => {
    const { status, data } = await fetchJson<any>(
      `/api/stored/agents/${TEST_ID}/versions/${v1Id}/restore`,
      { method: 'POST' },
    );
    expect(status).toBe(200);
    expect(data.versionNumber).toBe(3);
    expect(data.changeMessage).toBe('Restored from version 1');
    expect(data.instructions).toBe('v1');

    const after = await fetchJson<any>(`/api/stored/agents/${TEST_ID}/versions`);
    expect(after.data.total).toBe(3);
  });

  it('returns 404 for an unknown version id', async () => {
    const res = await fetchApi(
      `/api/stored/agents/${TEST_ID}/versions/00000000-0000-0000-0000-000000000000`,
    );
    expect([400, 404]).toContain(res.status);
  });

  // Use v2Id so it is treated as referenced (avoids dead-code linting on assignment).
  it('records v2 id as a stable uuid', () => {
    expect(v2Id).toMatch(UUID_RE);
  });
});
