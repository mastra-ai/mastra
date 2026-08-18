import { OBSERVATIONAL_MEMORY_SCHEMA } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { mastraObservationalMemoryTable } from './schema';
import { TABLE_INDEX_MAP } from './server/index-map';

/**
 * Drift guard for the hand-defined observational memory table.
 *
 * The table cannot be built from core's schema constants (they are excluded
 * from TABLE_SCHEMAS and this file is bundled into user deployments), so this
 * test fails when a column is added to core's OBSERVATIONAL_MEMORY_SCHEMA
 * without a matching field in mastraObservationalMemoryTable — the Convex
 * equivalent of pg's om-migration-columns guard.
 */
describe('mastraObservationalMemoryTable schema drift guard', () => {
  const exported = JSON.parse(JSON.stringify(mastraObservationalMemoryTable.export())) as {
    indexes: Array<{ indexDescriptor: string; fields: string[] }>;
    documentType: { type: string; value: Record<string, { fieldType: unknown; optional: boolean }> };
  };

  it('mirrors every column of core OBSERVATIONAL_MEMORY_SCHEMA', () => {
    const tableFields = Object.keys(exported.documentType.value).sort();
    const coreColumns = Object.keys(OBSERVATIONAL_MEMORY_SCHEMA).sort();
    expect(tableFields).toEqual(coreColumns);
  });

  it('marks exactly the nullable core columns as optional', () => {
    const optionalFields = Object.entries(exported.documentType.value)
      .filter(([, field]) => field.optional)
      .map(([name]) => name)
      .sort();
    const nullableColumns = Object.keys(OBSERVATIONAL_MEMORY_SCHEMA)
      .filter(column => OBSERVATIONAL_MEMORY_SCHEMA[column]!.nullable)
      .sort();
    expect(optionalFields).toEqual(nullableColumns);
  });

  it('defines the indexes registered in the server index map', () => {
    const tableIndexes = exported.indexes.map(index => ({ name: index.indexDescriptor, fields: index.fields }));
    expect(tableIndexes).toEqual(expect.arrayContaining(TABLE_INDEX_MAP.mastra_observational_memory!));
    expect(tableIndexes.map(index => index.name).sort()).toEqual(['by_lookup_key', 'by_record_id']);
  });
});
