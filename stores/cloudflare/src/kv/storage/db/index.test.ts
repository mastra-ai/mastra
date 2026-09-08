import type { KVNamespace } from '@cloudflare/workers-types';
import { TABLE_THREADS } from '@mastra/core/storage';
import type Cloudflare from 'cloudflare';
import { Miniflare } from 'miniflare';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { CloudflareKVDB } from '.';

describe('CloudflareKVDB listKV pagination (Workers binding)', () => {
  let mf: Miniflare;
  let db: CloudflareKVDB;

  beforeAll(async () => {
    mf = new Miniflare({
      script: 'export default {};',
      modules: true,
      kvNamespaces: [TABLE_THREADS],
    });
    const bindings = {
      [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
    } as Record<string, KVNamespace>;
    db = new CloudflareKVDB({ bindings: bindings as any, namespacePrefix: '' });
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it('returns all keys across multiple pages', async () => {
    const total = 15;
    for (let i = 0; i < total; i++) {
      await db.putKV({
        tableName: TABLE_THREADS,
        key: `${TABLE_THREADS}:thread-${String(i).padStart(3, '0')}`,
        value: { id: `thread-${i}` },
      });
    }

    const keys = await db.listKV(TABLE_THREADS, { limit: 10 });
    expect(keys.length).toBe(total);
  });

  it('honors prefix while paginating', async () => {
    const matching = Array.from({ length: 11 }, (_, i) => `prefixed:item-${String(i).padStart(2, '0')}`);
    for (const key of matching) {
      await db.putKV({ tableName: TABLE_THREADS, key, value: { key } });
    }
    for (let i = 0; i < 5; i++) {
      await db.putKV({ tableName: TABLE_THREADS, key: `unrelated:item-${i}`, value: { i } });
    }

    const keys = await db.listKV(TABLE_THREADS, { limit: 5, prefix: 'prefixed:' });
    expect(keys.map(k => k.name).sort()).toEqual(matching);
  });
});

describe('CloudflareKVDB listKV pagination (REST API)', () => {
  it('follows result_info.cursor across pages', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({ name: `${TABLE_THREADS}:thread-${i}` }));
    const page2 = Array.from({ length: 5 }, (_, i) => ({ name: `${TABLE_THREADS}:thread-${10 + i}` }));

    const keysList = vi
      .fn()
      .mockResolvedValueOnce({ result: page1, result_info: { count: 10, cursor: 'cursor-1' } })
      .mockResolvedValueOnce({ result: page2, result_info: { count: 5 } });
    const client = {
      kv: {
        namespaces: {
          list: vi.fn().mockResolvedValue({ result: [{ id: 'ns-1', title: TABLE_THREADS }] }),
          keys: { list: keysList },
        },
      },
    } as unknown as Cloudflare;

    const db = new CloudflareKVDB({ client, accountId: 'acc-1', namespacePrefix: '' });
    const keys = await db.listKV(TABLE_THREADS, { limit: 10 });

    expect(keys.map(k => k.name)).toEqual([...page1, ...page2].map(k => k.name));
    expect(keysList).toHaveBeenCalledTimes(2);
    expect(keysList.mock.calls[0]?.[1]).not.toHaveProperty('cursor');
    expect(keysList.mock.calls[1]?.[1]).toMatchObject({ cursor: 'cursor-1' });
  });
});
