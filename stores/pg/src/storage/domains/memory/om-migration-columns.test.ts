import { OBSERVATIONAL_MEMORY_SCHEMA } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { OM_MIGRATION_COLUMNS } from './index';

/**
 * Columns that existed in the original OM table creation.
 * Any column in OBSERVATIONAL_MEMORY_SCHEMA that is NOT listed here
 * must appear in OM_MIGRATION_COLUMNS — otherwise databases created
 * before that column was added will crash on missing columns.
 */
const OM_ORIGINAL_COLUMNS = [
  'id',
  'lookupKey',
  'scope',
  'resourceId',
  'threadId',
  'activeObservations',
  'activeObservationsPendingUpdate',
  'originType',
  'config',
  'generationCount',
  'lastObservedAt',
  'lastReflectionAt',
  'pendingMessageTokens',
  'totalTokensObserved',
  'observationTokenCount',
  'isObserving',
  'isReflecting',
  'createdAt',
  'updatedAt',
];

describe('OM auto-migration column coverage', () => {
  it('every schema column must be either an original column or in the migration list', () => {
    const allSchemaColumns = Object.keys(OBSERVATIONAL_MEMORY_SCHEMA);
    const covered = new Set([...OM_ORIGINAL_COLUMNS, ...OM_MIGRATION_COLUMNS]);

    const missing = allSchemaColumns.filter(col => !covered.has(col));
    expect(
      missing,
      `Schema columns missing from both OM_ORIGINAL_COLUMNS and OM_MIGRATION_COLUMNS: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('migration list should not contain columns that are not in the schema', () => {
    const allSchemaColumns = new Set(Object.keys(OBSERVATIONAL_MEMORY_SCHEMA));

    const extra = OM_MIGRATION_COLUMNS.filter(col => !allSchemaColumns.has(col));
    expect(
      extra,
      `OM_MIGRATION_COLUMNS references columns not in OBSERVATIONAL_MEMORY_SCHEMA: ${extra.join(', ')}`,
    ).toEqual([]);
  });

  it('migration list should not have duplicates', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const col of OM_MIGRATION_COLUMNS) {
      if (seen.has(col)) dupes.push(col);
      seen.add(col);
    }
    expect(dupes, `Duplicate entries in OM_MIGRATION_COLUMNS: ${dupes.join(', ')}`).toEqual([]);
  });
});
