import { describe, expect, it, vi } from 'vitest';

import { WORK_ITEMS_DDL, WorkItemsStoragePG } from './pg';

const ITEM_ID = '00000000-0000-4000-8000-000000000001';
const PARENT_ID = '00000000-0000-4000-8000-000000000002';

function dbRow(id: string, parentWorkItemId: string | null = null) {
  return {
    id,
    org_id: 'org-1',
    created_by: 'user-1',
    github_project_id: '00000000-0000-4000-8000-000000000010',
    source: 'github-issue',
    source_key: `github-issue:${id}`,
    parent_work_item_id: parentWorkItemId,
    title: `Item ${id}`,
    url: null,
    stages: ['intake'],
    stage_history: [],
    sessions: {},
    metadata: {},
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('WorkItemsStoragePG relations', () => {
  it('ships additive relation DDL with scoped ownership lookup and non-cascading deletion', () => {
    expect(WORK_ITEMS_DDL).toContain('ADD COLUMN IF NOT EXISTS parent_work_item_id uuid');
    expect(WORK_ITEMS_DDL).toContain('ON DELETE SET NULL');
    expect(WORK_ITEMS_DDL).toContain('ON work_items (org_id, github_project_id, parent_work_item_id)');
    expect(WORK_ITEMS_DDL).toContain("conrelid = 'work_items'::regclass");
  });

  it('takes the project advisory lock before locking and validating a relation update', async () => {
    const queries: string[] = [];
    const item = dbRow(ITEM_ID);
    const parent = dbRow(PARENT_ID);
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.startsWith('SELECT * FROM work_items WHERE id = $1 AND org_id = $2')) return { rows: [item] };
        if (sql === 'SELECT * FROM work_items WHERE id = $1 FOR UPDATE') return { rows: [item] };
        if (sql.startsWith('SELECT * FROM work_items WHERE org_id = $1')) return { rows: [item, parent] };
        if (sql.startsWith('UPDATE work_items SET')) return { rows: [{ ...item, parent_work_item_id: PARENT_ID }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };
    const storage = new WorkItemsStoragePG();
    await storage.init({ pool } as never);

    const result = await storage.update('org-1', ITEM_ID, 'user-1', { parentWorkItemId: PARENT_ID });

    expect(result?.item.parentWorkItemId).toBe(PARENT_ID);
    const advisoryIndex = queries.findIndex(sql => sql.startsWith('SELECT pg_advisory_xact_lock'));
    const rowLockIndex = queries.findIndex(sql => sql === 'SELECT * FROM work_items WHERE id = $1 FOR UPDATE');
    expect(advisoryIndex).toBeGreaterThan(-1);
    expect(rowLockIndex).toBeGreaterThan(advisoryIndex);
  });
});
