import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe('workspace JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
  });

  it('repairs version configuration and metadata while preserving literal escapes', async () => {
    const workspaces = await store.getStore('workspaces');
    const id = randomUUID();
    const literal = String.raw`literal\uD800`;
    await workspaces.create({
      workspace: {
        id,
        name: 'test',
        metadata: { path: 'C:\\path\\\uD800-end', literal, nul: 'a\0b' },
        filesystem: { provider: 'local', basePath: 'C:\\path\\\uD800-end' },
      },
    });

    expect((await workspaces.getById(id))?.metadata).toEqual({
      path: 'C:\\path\\�-end',
      literal,
      nul: 'ab',
    });
    expect((await workspaces.getLatestVersion(id))?.filesystem).toEqual({
      provider: 'local',
      basePath: 'C:\\path\\�-end',
    });

    const versionNumber = (await workspaces.getLatestVersion(id))?.versionNumber;
    await workspaces.update({ id, filesystem: { provider: 'local', basePath: 'C:\\path\\\uD800-end' } });
    expect((await workspaces.getLatestVersion(id))?.versionNumber).toBe(versionNumber);

    await workspaces.update({ id, metadata: { 'a\0b': 'new' } });
    await workspaces.update({ id, metadata: { 'a\0b': 'updated' } });
    expect((await workspaces.getById(id))?.metadata).toEqual({
      path: 'C:\\path\\�-end',
      literal,
      nul: 'ab',
      ab: 'updated',
    });
  });
});
