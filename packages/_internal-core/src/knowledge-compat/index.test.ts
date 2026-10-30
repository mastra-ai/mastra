import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_PAGES_TABLE_NAMES,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  createKnowledgePagesCoreLoader,
  inspectKnowledgePagesSchema,
  legacyKnowledgeTablesToDrop,
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

describe('old Knowledge tables dropped on init', () => {
  const published = [
    'mastra_knowledge_nodes',
    'mastra_knowledge_records',
    'mastra_knowledge_mentions',
    'mastra_knowledge_activity',
    'mastra_knowledge_semantic_outbox',
    'mastra_knowledge_access_state',
    'mastra_knowledge_cursors',
  ];

  it('drops a whole published layout, including the names schema 4 reuses', () => {
    const drop = legacyKnowledgeTablesToDrop({ tableNames: [...published, 'mastra_threads'], schemaVersion: 2 });
    expect(new Set(drop)).toEqual(new Set(published));
    expect(drop.indexOf('mastra_knowledge_records')).toBeLessThan(drop.indexOf('mastra_knowledge_nodes'));
  });

  it('on a schema-4 store drops only what an older process recreated, never schema-4 tables', () => {
    const drop = legacyKnowledgeTablesToDrop({
      tableNames: [
        ...KNOWLEDGE_PAGES_TABLE_NAMES,
        'mastra_knowledge_nodes',
        'mastra_knowledge_records',
        'mastra_knowledge_semantic_outbox',
      ],
      schemaVersion: 4,
    });
    expect(new Set(drop)).toEqual(
      new Set(['mastra_knowledge_nodes', 'mastra_knowledge_records', 'mastra_knowledge_semantic_outbox']),
    );
  });

  it('drops nothing on an empty or clean schema-4 store, or schema-4 tables alone', () => {
    expect(legacyKnowledgeTablesToDrop({ tableNames: [] })).toEqual([]);
    expect(legacyKnowledgeTablesToDrop({ tableNames: [...KNOWLEDGE_PAGES_TABLE_NAMES], schemaVersion: 4 })).toEqual([]);
    expect(legacyKnowledgeTablesToDrop({ tableNames: [...KNOWLEDGE_PAGES_TABLE_NAMES] })).toEqual([]);
  });

  it('leaves a store that inspects clean once the listed tables are gone', () => {
    const tableNames = [...published, 'mastra_knowledge_pages'];
    const drop = new Set(legacyKnowledgeTablesToDrop({ tableNames, schemaVersion: 2 }));
    expect(drop.has('mastra_knowledge_pages')).toBe(false);
    const rest = tableNames.filter(name => !drop.has(name));
    expect(rest).toEqual(['mastra_knowledge_pages']);
  });
});

describe('schema 4 core loader', () => {
  it('refuses a core without the knowledge-pages feature', async () => {
    const load = createKnowledgePagesCoreLoader(new Set(['knowledge-v2']), async () => ({}));
    await expect(load()).rejects.toThrow(/knowledge-pages/);
  });

  it("hands back core's page-store runtime", async () => {
    class DepthError extends Error {}
    const storageModule = {
      assertKnowledgePageDescriptionWithinBound: () => {},
      assertKnowledgeNoteTextWithinBound: () => {},
      canonicalKnowledgeName: (name: string) => name.toLowerCase(),
      knowledgePositionBetween: () => 'm',
      MAX_KNOWLEDGE_MOVE_PAGES: 500,
      MAX_KNOWLEDGE_PAGE_DEPTH: 10,
      MAX_KNOWLEDGE_PAGE_LIST_LIMIT: 100,
      KnowledgeMoveTooLargeError: Error,
      KnowledgePageDepthError: DepthError,
      KnowledgePageHasChildrenError: Error,
      KnowledgePageKeyConflictError: Error,
    };
    const load = createKnowledgePagesCoreLoader(new Set(['knowledge-pages']), async () => storageModule);
    const core = await load();
    expect(core.canonicalKnowledgeName('Atlas')).toBe('atlas');
    expect(core.MAX_KNOWLEDGE_PAGE_DEPTH).toBe(10);
    // Errors keep core's class identity, so `instanceof` checks against core's exports still hold.
    expect(new core.KnowledgePageDepthError('p')).toBeInstanceOf(DepthError);
    expect(await load()).toBe(core);
  });

  it('names what a core advertising knowledge-pages is missing', async () => {
    const load = createKnowledgePagesCoreLoader(new Set(['knowledge-pages']), async () => ({
      assertKnowledgePageDescriptionWithinBound: () => {},
      assertKnowledgeNoteTextWithinBound: () => {},
    }));
    await expect(load()).rejects.toThrow(/missing canonicalKnowledgeName,.*MAX_KNOWLEDGE_PAGE_LIST_LIMIT/);
  });
});
