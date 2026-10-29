import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_PAGES_TABLE_NAMES,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  createKnowledgePagesCoreLoader,
  inspectKnowledgePagesSchema,
} from './index';

describe('schema 4 inspection', () => {
  it('is uninitialized on an empty store', () => {
    expect(inspectKnowledgePagesSchema({ tableNames: [] }).status).toBe('uninitialized');
  });

  it('is compatible once the state row says 4', () => {
    expect(inspectKnowledgePagesSchema({ tableNames: [...KNOWLEDGE_PAGES_TABLE_NAMES], schemaVersion: 4 })).toEqual({
      status: 'compatible',
      schemaVersion: KNOWLEDGE_PAGES_SCHEMA_VERSION,
    });
  });

  it('needs a reset when schema-2 tables are present, even next to schema-4 ones', () => {
    const inspection = inspectKnowledgePagesSchema({
      tableNames: ['mastra_knowledge_nodes', 'mastra_knowledge_records', 'mastra_knowledge_mentions'],
      schemaVersion: 2,
    });
    expect(inspection.status).toBe('incompatible-reset-required');
    expect(inspectKnowledgePagesSchema({ tableNames: ['mastra_knowledge_cursors'] }).status).toBe(
      'incompatible-reset-required',
    );
  });

  it('needs a reset for shared-name tables without a version row, or another version', () => {
    expect(inspectKnowledgePagesSchema({ tableNames: ['mastra_knowledge_mentions'] }).status).toBe(
      'incompatible-reset-required',
    );
    expect(inspectKnowledgePagesSchema({ tableNames: [...KNOWLEDGE_PAGES_TABLE_NAMES], schemaVersion: 3 }).status).toBe(
      'incompatible-reset-required',
    );
  });

  it('resets only Knowledge tables, covering every schema', () => {
    expect(KNOWLEDGE_RESETTABLE_TABLE_NAMES.every(name => name.startsWith('mastra_knowledge_'))).toBe(true);
    expect(KNOWLEDGE_RESETTABLE_TABLE_NAMES).toEqual(
      expect.arrayContaining([...KNOWLEDGE_PAGES_TABLE_NAMES, 'mastra_knowledge_nodes', 'mastra_knowledge_cursors']),
    );
    expect(new Set(KNOWLEDGE_RESETTABLE_TABLE_NAMES).size).toBe(KNOWLEDGE_RESETTABLE_TABLE_NAMES.length);
  });
});

describe('schema 4 core loader', () => {
  it('refuses a core without the knowledge-pages feature', async () => {
    const load = createKnowledgePagesCoreLoader(new Set(['knowledge-v2']), async () => ({}));
    await expect(load()).rejects.toThrow(/knowledge-pages/);
  });

  it("uses core's bound helpers", async () => {
    const calls: string[] = [];
    const load = createKnowledgePagesCoreLoader(new Set(['knowledge-pages']), async () => ({
      assertKnowledgePageDescriptionWithinBound: (d: string) => calls.push(`d:${d}`),
      assertKnowledgeNoteTextWithinBound: (t: string) => calls.push(`n:${t}`),
    }));
    const core = await load();
    core.assertKnowledgePageDescriptionWithinBound('x');
    core.assertKnowledgeNoteTextWithinBound('y');
    expect(calls).toEqual(['d:x', 'n:y']);
  });
});
