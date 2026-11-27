import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { KnowledgeStorage } from '@mastra/core/storage';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { KnowledgeLibSQL } from '.';

const dir = mkdtempSync(join(tmpdir(), 'knowledge-parents-'));
const client = createClient({ url: `file:${join(dir, 'knowledge.db')}` });
afterAll(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('KnowledgeLibSQL getPageParents', () => {
  it('reads a 9-deep chain in one statement, not one per level', async () => {
    const store = new KnowledgeLibSQL({ client });
    await store.init();
    const provenance = { author: 'alex' };
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance,
    });
    let parentId = scope.id;
    const chain = [scope.id];
    for (let level = 0; level < 9; level++) {
      const page = await store.createPage({ parentId, name: `L${level}`, key: `l${level}`, provenance });
      chain.unshift(page.id);
      parentId = page.id;
    }

    const base = vi.spyOn(KnowledgeStorage.prototype, 'getPageParents');
    const execute = vi.spyOn(client, 'execute');
    try {
      const parents = await store.getPageParents({ parentId, read: 'all' });
      expect(parents.map(page => page.id)).toEqual(chain);
      expect(base).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      base.mockRestore();
      execute.mockRestore();
    }
  });
});
