import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentAvatarsLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('AgentAvatarsLibSQL', () => {
  let client: Client;
  let store: AgentAvatarsLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new AgentAvatarsLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(() => {
    client.close();
  });

  it('returns null for a missing avatar', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('put/get round-trips bytes, mime, size, and timestamps', async () => {
    const data = PNG_HEADER.toString('base64');
    await store.put({ agentId: 'a1', data, mime: 'image/png' });

    const row = await store.get('a1');
    expect(row?.agentId).toBe('a1');
    expect(row?.data).toBe(data);
    expect(Buffer.from(row!.data, 'base64').equals(PNG_HEADER)).toBe(true);
    expect(row?.mime).toBe('image/png');
    expect(row?.sizeBytes).toBe(PNG_HEADER.length);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it('put upserts: replaces bytes/mime and preserves createdAt', async () => {
    await store.put({ agentId: 'a2', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    const first = await store.get('a2');

    const gif = Buffer.from('GIF89a').toString('base64');
    await store.put({ agentId: 'a2', data: gif, mime: 'image/gif' });
    const second = await store.get('a2');

    expect(second?.data).toBe(gif);
    expect(second?.mime).toBe('image/gif');
    expect(second?.createdAt).toEqual(first?.createdAt);
  });

  it('delete removes the row and is a no-op when missing', async () => {
    await store.put({ agentId: 'a3', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await store.delete('a3');
    expect(await store.get('a3')).toBeNull();
    await expect(store.delete('a3')).resolves.toBeUndefined();
  });

  it('dangerouslyClearAll removes all rows', async () => {
    await store.put({ agentId: 'a4', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await store.put({ agentId: 'a5', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await store.dangerouslyClearAll();
    expect(await store.get('a4')).toBeNull();
    expect(await store.get('a5')).toBeNull();
  });
});
