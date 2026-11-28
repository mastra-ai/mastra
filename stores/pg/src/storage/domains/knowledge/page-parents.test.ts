import { KnowledgeStorage } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { connectionString as defaultConnectionString } from '../../test-utils';

import { KnowledgePG } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const schemaName = 'knowledge_page_parents_test';
const pool = new Pool({ connectionString });
const store = new KnowledgePG({ pool, schemaName });

beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await pool.query(`CREATE SCHEMA ${schemaName}`);
  await store.init();
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await pool.end();
});

describe('KnowledgePG getPageParents', () => {
  it('reads a 9-deep chain in one statement, not one per level', async () => {
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
    const query = vi.spyOn(pool, 'query');
    try {
      const parents = await store.getPageParents({ parentId, read: 'all' });
      expect(parents.map(page => page.id)).toEqual(chain);
      expect(base).not.toHaveBeenCalled();
      // `pool.query` checks a connection out through `pool.connect` itself, so count queries only.
      expect(query).toHaveBeenCalledTimes(1);
    } finally {
      base.mockRestore();
      query.mockRestore();
    }
  });
});
