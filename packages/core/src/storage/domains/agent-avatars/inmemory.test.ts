import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryAgentAvatarsStorage } from './inmemory';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('InMemoryAgentAvatarsStorage', () => {
  let db: InMemoryDB;
  let store: InMemoryAgentAvatarsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    store = new InMemoryAgentAvatarsStorage({ db });
  });

  it('put/get round-trips a row with size and timestamps', async () => {
    const data = PNG_HEADER.toString('base64');
    await store.put({ agentId: 'a1', data, mime: 'image/png' });

    const row = await store.get('a1');
    expect(row?.agentId).toBe('a1');
    expect(row?.data).toBe(data);
    expect(row?.mime).toBe('image/png');
    expect(row?.sizeBytes).toBe(PNG_HEADER.length);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it('get returns null for missing rows', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('put replaces an existing row and preserves createdAt', async () => {
    await store.put({ agentId: 'a2', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    const first = await store.get('a2');

    await store.put({ agentId: 'a2', data: Buffer.from('GIF89a').toString('base64'), mime: 'image/gif' });
    const second = await store.get('a2');

    expect(second?.mime).toBe('image/gif');
    expect(second?.createdAt).toEqual(first?.createdAt);
  });

  it('delete removes the row and is a no-op when missing', async () => {
    await store.put({ agentId: 'a3', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await store.delete('a3');
    expect(await store.get('a3')).toBeNull();
    await expect(store.delete('a3')).resolves.toBeUndefined();
  });

  it('dangerouslyClearAll empties the map', async () => {
    await store.put({ agentId: 'a4', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await store.dangerouslyClearAll();
    expect(await store.get('a4')).toBeNull();
  });

  it('clears together with InMemoryDB.clear()', async () => {
    await store.put({ agentId: 'a5', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    db.clear();
    expect(await store.get('a5')).toBeNull();
  });
});
