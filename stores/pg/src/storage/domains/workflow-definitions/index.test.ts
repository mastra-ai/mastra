import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectionString } from '../../test-utils';
import { WorkflowDefinitionsPG } from './index';

const createTestPool = () => new Pool({ connectionString });

const baseGraph = [
  {
    type: 'tool' as const,
    id: 'echo-tool',
    toolId: 'echo-tool',
  },
];

const baseInput = {
  id: 'wf-1',
  description: 'first workflow',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { greeting: { type: 'string' } } },
  graph: baseGraph as any,
};

describe('WorkflowDefinitionsPG', () => {
  let pool: Pool;
  let store: WorkflowDefinitionsPG;

  beforeEach(async () => {
    pool = createTestPool();
    store = new WorkflowDefinitionsPG({ pool });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(async () => {
    await pool?.end();
  });

  it('upserts and reads a workflow definition', async () => {
    const created = await store.upsert(baseInput);
    expect(created).toMatchObject({
      id: 'wf-1',
      description: 'first workflow',
      status: 'active',
      source: 'storage',
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const fetched = await store.get('wf-1');
    expect(fetched?.id).toBe('wf-1');
    expect(fetched?.graph).toEqual(baseGraph);
    expect(fetched?.inputSchema).toEqual(baseInput.inputSchema);
  });

  it('returns null for a missing workflow', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('updates existing rows without losing createdAt', async () => {
    const created = await store.upsert(baseInput);
    const updated = await store.upsert({ id: 'wf-1', description: 'renamed' });
    expect(updated.description).toBe('renamed');
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('lists workflows, filters by status, and archives via update', async () => {
    await store.upsert(baseInput);
    await store.upsert({ ...baseInput, id: 'wf-2', description: 'second' });

    const all = await store.list();
    expect(all.total).toBe(2);

    await store.upsert({ id: 'wf-2', status: 'archived' });
    const active = await store.list({ status: 'active' });
    expect(active.total).toBe(1);
    expect(active.definitions[0]?.id).toBe('wf-1');

    const archived = await store.list({ status: 'archived' });
    expect(archived.total).toBe(1);
    expect(archived.definitions[0]?.id).toBe('wf-2');
  });

  it('deletes a workflow definition', async () => {
    await store.upsert(baseInput);
    await store.delete('wf-1');
    expect(await store.get('wf-1')).toBeNull();
  });

  it('preserves optional metadata and schemas across round-trip', async () => {
    await store.upsert({
      ...baseInput,
      metadata: { owner: 'me' },
      stateSchema: { type: 'object' },
      requestContextSchema: { type: 'object' },
      authorId: 'author-1',
    });
    const fetched = await store.get('wf-1');
    expect(fetched?.metadata).toEqual({ owner: 'me' });
    expect(fetched?.stateSchema).toEqual({ type: 'object' });
    expect(fetched?.requestContextSchema).toEqual({ type: 'object' });
    expect(fetched?.authorId).toBe('author-1');
  });
});
