import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectionString } from '../../test-utils';
import { ToolProviderConnectionsPG } from './index';

const createTestPool = () => new Pool({ connectionString });

describe('ToolProviderConnectionsPG', () => {
  let pool: Pool;
  let store: ToolProviderConnectionsPG;

  beforeEach(async () => {
    pool = createTestPool();
    store = new ToolProviderConnectionsPG({ pool });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(async () => {
    await pool?.end();
  });

  const baseInput = {
    authorId: 'author-1',
    providerId: 'composio',
    toolkit: 'github',
    connectionId: 'conn-1',
    label: 'My GitHub',
  };

  it('upserts and reads a connection by id', async () => {
    const created = await store.upsertConnection(baseInput);
    expect(created).toMatchObject({
      authorId: 'author-1',
      providerId: 'composio',
      toolkit: 'github',
      connectionId: 'conn-1',
      label: 'My GitHub',
      scope: 'per-author',
    });

    const fetched = await store.getConnectionById({
      authorId: 'author-1',
      providerId: 'composio',
      connectionId: 'conn-1',
    });
    expect(fetched).toMatchObject({ toolkit: 'github', label: 'My GitHub', scope: 'per-author' });
  });

  it('preserves createdAt and scope on update', async () => {
    const created = await store.upsertConnection({ ...baseInput, scope: 'shared' });

    const updated = await store.upsertConnection({ ...baseInput, label: 'Renamed' });

    expect(updated.label).toBe('Renamed');
    expect(updated.scope).toBe('shared');
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('returns null for a missing connection', async () => {
    const fetched = await store.getConnectionById({
      authorId: 'nope',
      providerId: 'composio',
      connectionId: 'missing',
    });
    expect(fetched).toBeNull();
  });

  it('lists connections by author with optional filters', async () => {
    await store.upsertConnection(baseInput);
    await store.upsertConnection({ ...baseInput, connectionId: 'conn-2', toolkit: 'slack' });
    await store.upsertConnection({ ...baseInput, authorId: 'author-2', connectionId: 'conn-3' });

    const byAuthor = await store.listConnectionsByAuthor({ authorId: 'author-1' });
    expect(byAuthor).toHaveLength(2);

    const byToolkit = await store.listConnectionsByAuthor({ authorId: 'author-1', toolkit: 'slack' });
    expect(byToolkit).toHaveLength(1);
    expect(byToolkit[0]!.connectionId).toBe('conn-2');
  });

  it('deletes a connection', async () => {
    await store.upsertConnection(baseInput);
    await store.deleteConnection({
      authorId: 'author-1',
      providerId: 'composio',
      connectionId: 'conn-1',
    });

    const fetched = await store.getConnectionById({
      authorId: 'author-1',
      providerId: 'composio',
      connectionId: 'conn-1',
    });
    expect(fetched).toBeNull();
  });
});
