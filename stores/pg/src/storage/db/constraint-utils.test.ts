import { TABLE_WORKFLOW_SNAPSHOT, TABLE_SCHEMAS } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { POSTGRES_IDENTIFIER_MAX_LENGTH, truncateIdentifier, buildConstraintName } from './constraint-utils';
import { generateTableSQL } from './index';

// ---------------------------------------------------------------------------
// truncateIdentifier
// ---------------------------------------------------------------------------
describe('truncateIdentifier', () => {
  it('returns the value unchanged when shorter than the limit', () => {
    expect(truncateIdentifier('short_name')).toBe('short_name');
  });

  it('returns the value unchanged when exactly at the byte limit', () => {
    const exact = 'a'.repeat(POSTGRES_IDENTIFIER_MAX_LENGTH); // 63 ASCII chars = 63 bytes
    expect(truncateIdentifier(exact)).toBe(exact);
    expect(Buffer.byteLength(truncateIdentifier(exact), 'utf-8')).toBe(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });

  it('truncates an ASCII string that exceeds the byte limit', () => {
    const long = 'a'.repeat(POSTGRES_IDENTIFIER_MAX_LENGTH + 10);
    const result = truncateIdentifier(long);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
    expect(result).toBe('a'.repeat(POSTGRES_IDENTIFIER_MAX_LENGTH));
  });

  it('truncates by bytes, not characters (multibyte UTF-8)', () => {
    // '€' is 3 bytes in UTF-8.  21 of them = 63 bytes = exactly the limit.
    const within = '€'.repeat(21);
    expect(truncateIdentifier(within)).toBe(within);
    expect(Buffer.byteLength(truncateIdentifier(within), 'utf-8')).toBe(63);

    // 22 of them = 66 bytes > 63, so the result must drop to 21 characters.
    const over = '€'.repeat(22);
    const result = truncateIdentifier(over);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
    expect(result).toBe('€'.repeat(21));
  });

  it('respects a custom maxLength', () => {
    const result = truncateIdentifier('abcdefghij', 5);
    expect(result).toBe('abcde');
  });

  it('returns an empty string unchanged', () => {
    expect(truncateIdentifier('')).toBe('');
  });

  it('does not split a multibyte character at the boundary', () => {
    // '😀' is 4 bytes in UTF-8.  With maxLength=3, we cannot fit even one emoji.
    const result = truncateIdentifier('😀hello', 3);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// buildConstraintName
// ---------------------------------------------------------------------------
describe('buildConstraintName', () => {
  it('returns the base name when no schema is provided', () => {
    expect(buildConstraintName({ baseName: 'my_constraint' })).toBe('my_constraint');
  });

  it('prepends the schema name as a prefix', () => {
    const result = buildConstraintName({ baseName: 'my_constraint', schemaName: 'myschema' });
    expect(result).toBe('myschema_my_constraint');
  });

  it('lowercases the result for pg catalog compatibility', () => {
    const result = buildConstraintName({ baseName: 'My_Constraint', schemaName: 'MySchema' });
    expect(result).toBe('myschema_my_constraint');
  });

  it('truncates the combined name to fit within Postgres limit', () => {
    const longSchema = 'a'.repeat(40);
    const baseName = 'b'.repeat(30); // 40 + 1 (underscore) + 30 = 71 > 63
    const result = buildConstraintName({ baseName, schemaName: longSchema });
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });

  it('uses POSTGRES_IDENTIFIER_MAX_LENGTH (63) as the default limit', () => {
    expect(POSTGRES_IDENTIFIER_MAX_LENGTH).toBe(63);
  });

  it('respects a custom maxLength', () => {
    const result = buildConstraintName({ baseName: 'constraint', schemaName: 'schema', maxLength: 10 });
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toBe('schema_con');
  });
});

// ---------------------------------------------------------------------------
// Constraint names used in the PG store
// ---------------------------------------------------------------------------
describe('production constraint names', () => {
  // The canonical base name is the original long form.  buildConstraintName
  // only truncates when a schema prefix pushes it past the 63-byte limit.
  const WORKFLOW_SNAPSHOT_BASE = 'mastra_workflow_snapshot_workflow_name_run_id_key';
  const SPANS_PK_BASE = 'mastra_ai_spans_traceid_spanid_pk';

  it('generates valid names without a schema', () => {
    const wf = buildConstraintName({ baseName: WORKFLOW_SNAPSHOT_BASE });
    const spans = buildConstraintName({ baseName: SPANS_PK_BASE });

    expect(wf).toBe(WORKFLOW_SNAPSHOT_BASE);
    expect(spans).toBe(SPANS_PK_BASE);
    expect(Buffer.byteLength(wf, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
    expect(Buffer.byteLength(spans, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });

  it('generates valid names with a typical short schema', () => {
    const wf = buildConstraintName({ baseName: WORKFLOW_SNAPSHOT_BASE, schemaName: 'myapp' });
    const spans = buildConstraintName({ baseName: SPANS_PK_BASE, schemaName: 'myapp' });

    // The full name fits within 63 bytes, so no truncation occurs.
    expect(wf).toBe('myapp_mastra_workflow_snapshot_workflow_name_run_id_key');
    expect(spans).toBe('myapp_mastra_ai_spans_traceid_spanid_pk');
    expect(Buffer.byteLength(wf, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
    expect(Buffer.byteLength(spans, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });

  it('truncates with a long schema name while staying within limit', () => {
    const longSchema = 'very_long_production_schema_name';
    const wf = buildConstraintName({ baseName: WORKFLOW_SNAPSHOT_BASE, schemaName: longSchema });
    const spans = buildConstraintName({ baseName: SPANS_PK_BASE, schemaName: longSchema });

    expect(Buffer.byteLength(wf, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
    expect(Buffer.byteLength(spans, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility with old (pre-PR) constraint names
// ---------------------------------------------------------------------------
describe('backward compatibility', () => {
  /**
   * Before this PR, constraint names were built as:
   *   `${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key`
   *   `${constraintPrefix}mastra_ai_spans_traceid_spanid_pk`
   * where constraintPrefix = schemaName ? `${schemaName}_` : ''.
   *
   * No truncation or lowercasing was applied, so names could exceed the 63-byte
   * PG limit.  With this PR, names are explicitly truncated and lowercased, and
   * we keep the original long base name so existing databases are detected
   * correctly by the IF NOT EXISTS checks.
   */

  it('produces lowercase names that match what pg_constraint stores for unquoted identifiers', () => {
    const name = buildConstraintName({
      baseName: 'Mastra_AI_Spans_TraceId_SpanId_PK',
      schemaName: 'MySchema',
    });
    expect(name).toBe(name.toLowerCase());
  });

  it('no-schema workflow snapshot constraint matches the pre-PR name', () => {
    // Before this PR: 'mastra_workflow_snapshot_workflow_name_run_id_key'
    // After this PR:  buildConstraintName with the same base name
    const newName = buildConstraintName({
      baseName: 'mastra_workflow_snapshot_workflow_name_run_id_key',
    });
    const oldName = 'mastra_workflow_snapshot_workflow_name_run_id_key';
    expect(newName).toBe(oldName.toLowerCase());
  });

  it('short-schema workflow snapshot constraint matches the pre-PR name', () => {
    // Old: 'myapp_mastra_workflow_snapshot_workflow_name_run_id_key' (55 chars, fits)
    const newName = buildConstraintName({
      baseName: 'mastra_workflow_snapshot_workflow_name_run_id_key',
      schemaName: 'myapp',
    });
    const oldName = 'myapp_mastra_workflow_snapshot_workflow_name_run_id_key';
    expect(newName).toBe(oldName.toLowerCase());
    expect(Buffer.byteLength(newName, 'utf-8')).toBeLessThanOrEqual(POSTGRES_IDENTIFIER_MAX_LENGTH);
  });

  it('no-schema spans constraint matches the pre-PR name', () => {
    const newName = buildConstraintName({ baseName: 'mastra_ai_spans_traceid_spanid_pk' });
    const oldName = 'mastra_ai_spans_traceid_spanid_pk';
    expect(newName).toBe(oldName.toLowerCase());
  });

  it('short-schema spans constraint matches the pre-PR name', () => {
    const newName = buildConstraintName({ baseName: 'mastra_ai_spans_traceid_spanid_pk', schemaName: 'myapp' });
    const oldName = 'myapp_mastra_ai_spans_traceid_spanid_pk';
    expect(newName).toBe(oldName.toLowerCase());
  });

  it('long schema names are truncated to 63 bytes, matching PostgreSQL silent truncation', () => {
    const longSchema = 'a_very_long_schema_name_that_pushes_the_limit';
    const baseName = 'mastra_ai_spans_traceid_spanid_pk';
    const fullUntruncated = `${longSchema}_${baseName}`.toLowerCase();

    const newName = buildConstraintName({ baseName, schemaName: longSchema });

    expect(Buffer.byteLength(newName, 'utf-8')).toBeLessThanOrEqual(63);
    expect(fullUntruncated.startsWith(newName)).toBe(true);
  });

  it('long schema + workflow snapshot truncates consistently with what PG stored', () => {
    // Schema long enough that the combined name exceeds 63 bytes.
    // PostgreSQL would have silently truncated; our code now does the same.
    const longSchema = 'long_production_schema';
    const baseName = 'mastra_workflow_snapshot_workflow_name_run_id_key';
    const fullUntruncated = `${longSchema}_${baseName}`.toLowerCase();

    const newName = buildConstraintName({ baseName, schemaName: longSchema });

    expect(Buffer.byteLength(newName, 'utf-8')).toBeLessThanOrEqual(63);
    // The truncated name is a prefix of the full (untruncated) name.
    expect(fullUntruncated.startsWith(newName)).toBe(true);
  });

  it('SQL lookups using lower() find constraints regardless of case in the original name', () => {
    const mixedCase = buildConstraintName({
      baseName: 'Mastra_AI_Spans_TraceId_SpanId_PK',
      schemaName: 'MyApp',
    });
    expect(mixedCase.toLowerCase()).toBe(mixedCase);
  });
});

// ---------------------------------------------------------------------------
// generateTableSQL — REPLICA IDENTITY for workflow snapshot table
// ---------------------------------------------------------------------------
describe('generateTableSQL REPLICA IDENTITY', () => {
  it('includes REPLICA IDENTITY USING INDEX for workflow snapshot table', () => {
    const sql = generateTableSQL({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    expect(sql).toContain('REPLICA IDENTITY USING INDEX');
  });

  it('includes REPLICA IDENTITY USING INDEX with a custom schema name', () => {
    const sql = generateTableSQL({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      schemaName: 'custom_schema',
    });
    expect(sql).toContain('REPLICA IDENTITY USING INDEX');
    expect(sql).toContain('custom_schema');
  });
});
