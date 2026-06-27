import { describe, expect, it } from 'vitest';

import {
  assertJsonPath,
  indexNameForMetadataField,
  indexNameForTable,
  jsonPathForPredicatePrefix,
  legacyCanonicalIndexName,
  normalizeIdentifier,
  normalizeLogicalIndexName,
  qualifyName,
  quoteIdentifier,
  tableNameForIndex,
} from './identifiers';

// Identifier tests protect the boundary between user-facing names and Oracle object names.
describe('Oracle SQL identifier helpers', () => {
  it('normalizes strict and logical identifiers with validation', () => {
    expect(normalizeIdentifier(' table_1 ', 'table')).toBe('TABLE_1');
    expect(() => normalizeIdentifier('1bad', 'table')).toThrow(/start with a letter/i);
    expect(() => normalizeIdentifier(`A${'X'.repeat(128)}`, 'table')).toThrow(/128/);
    expect(normalizeLogicalIndexName(' mixed.name ')).toBe('mixed.name');
    expect(() => normalizeLogicalIndexName('')).toThrow(/cannot be empty/i);
    expect(() => normalizeLogicalIndexName('x'.repeat(513))).toThrow(/512/);
    expect(legacyCanonicalIndexName('legacy_name')).toBe('LEGACY_NAME');
    expect(quoteIdentifier('obj', 'object')).toBe('"OBJ"');
  });

  it('normalizes Mastra index names into deterministic Oracle table names', () => {
    expect(tableNameForIndex('agent_memory', 'mastra_vec')).toBe('MASTRA_VEC_AGENT_MEMORY');
    expect(indexNameForTable('mastra_vec_agent_memory', 'vector_idx')).toBe('MASTRA_VEC_AGENT_MEMORY_VECTOR_IDX');
  });

  it('maps non-Oracle logical index names to safe physical names', () => {
    expect(tableNameForIndex('tenant-a/docs.v1', 'mastra_vec')).toMatch(/^MASTRA_VEC_TENANT_A_DOCS_V1$/);
  });

  it('hashes long physical index names deterministically', () => {
    const longName = `idx_${'x'.repeat(180)}`;
    const tableName = tableNameForIndex(longName, 'mastra_vec');
    expect(tableName.length).toBeLessThanOrEqual(128);
    expect(tableName).toMatch(/_[A-F0-9]{12}$/);
  });

  it('hashes metadata index field names', () => {
    expect(indexNameForMetadataField('mastra_vec_agent_memory', 'user-id')).toMatch(
      /^MASTRA_VEC_AGENT_MEMORY_MD_[A-F0-9]{12}_IDX$/,
    );
  });

  it('qualifies names with quoted Oracle identifiers', () => {
    expect(qualifyName('mastra_vec_agent_memory', 'app_schema')).toBe('"APP_SCHEMA"."MASTRA_VEC_AGENT_MEMORY"');
  });

  it('rejects unsafe identifiers', () => {
    expect(() => qualifyName('safe_name', 'bad schema')).toThrow(/schema name/);
  });

  it('builds safe JSON paths for non-identifier metadata keys', () => {
    expect(assertJsonPath('source-id.section title')).toBe('$."source-id"."section title"');
    expect(assertJsonPath('quoted"key.back\\slash')).toBe('$."quoted\\"key"."back\\\\slash"');
    expect(jsonPathForPredicatePrefix('item.kind')).toBe('@.item.kind');
  });

  it('rejects JSON metadata paths with control characters', () => {
    expect(() => assertJsonPath('bad\u0000key')).toThrow(/Invalid JSON metadata path/i);
  });
});
