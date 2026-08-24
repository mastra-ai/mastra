import type { KVNamespace } from '@cloudflare/workers-types';
import { TABLE_THREADS } from '@mastra/core/storage';
import { Miniflare } from 'miniflare';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { CloudflareKVDB } from '.';

describe('CloudflareKVDB listKV pagination', () => {
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
    const keys = await db.listKV(TABLE_THREADS, { limit: 10, prefix: `${TABLE_THREADS}:thread-01` });
    expect(keys.map(k => k.name).sort()).toEqual([
      `${TABLE_THREADS}:thread-010`,
      `${TABLE_THREADS}:thread-011`,
      `${TABLE_THREADS}:thread-012`,
      `${TABLE_THREADS}:thread-013`,
      `${TABLE_THREADS}:thread-014`,
    ]);
  });
});
