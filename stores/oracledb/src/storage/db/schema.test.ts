import {
  TABLE_RESOURCES,
  TABLE_AGENT_VERSIONS,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import {
  filterIndexesForTables,
  generateOracleIndexSQL,
  generateOracleTableSQL,
  oracleColumnType,
  parseOracleJson,
} from '.';

describe('Oracle storage table DDL', () => {
  it('generates Oracle table DDL from selected Mastra storage schemas', () => {
    expect(
      generateOracleTableSQL({
        tableName: TABLE_MCP_CLIENTS,
        schema: TABLE_SCHEMAS[TABLE_MCP_CLIENTS],
        schemaName: 'app_schema',
      }),
    ).toBe(`CREATE TABLE "APP_SCHEMA"."MASTRA_MCP_CLIENTS" (
  id VARCHAR2(512) PRIMARY KEY,
  status VARCHAR2(4000) NOT NULL,
  "activeVersionId" VARCHAR2(512),
  "authorId" VARCHAR2(512),
  metadata JSON,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
)`);
  });

  it('maps long editor text fields to CLOB instead of VARCHAR2', () => {
    expect(
      oracleColumnType(TABLE_AGENT_VERSIONS, 'instructions', TABLE_SCHEMAS[TABLE_AGENT_VERSIONS].instructions!),
    ).toBe('CLOB');
  });

  it('parses Oracle JSON values returned as strings, buffers, or native objects', () => {
    expect(parseOracleJson('{"kind":"mcp"}')).toEqual({ kind: 'mcp' });
    expect(parseOracleJson(Buffer.from('{"kind":"agent"}'))).toEqual({ kind: 'agent' });
    expect(parseOracleJson({ kind: 'native' })).toEqual({ kind: 'native' });
    expect(parseOracleJson(null)).toBeUndefined();
    expect(parseOracleJson(undefined)).toBeUndefined();
    expect(parseOracleJson('not-json')).toBe('not-json');
  });

  it('maps Mastra storage column types to Oracle column types', () => {
    expect(oracleColumnType(TABLE_THREADS, 'id', { type: 'text', primaryKey: true } as any)).toBe('VARCHAR2(512)');
    expect(oracleColumnType(TABLE_THREADS, 'title', { type: 'text' } as any)).toBe('VARCHAR2(4000)');
    expect(oracleColumnType(TABLE_MESSAGES, 'content', { type: 'text' } as any)).toBe('CLOB');
    expect(oracleColumnType(TABLE_THREADS, 'uuid_col', { type: 'uuid' } as any)).toBe('VARCHAR2(36)');
    expect(oracleColumnType(TABLE_THREADS, 'ts', { type: 'timestamp' } as any)).toBe('TIMESTAMP WITH TIME ZONE');
    expect(oracleColumnType(TABLE_THREADS, 'json', { type: 'jsonb' } as any)).toBe('JSON');
    expect(oracleColumnType(TABLE_THREADS, 'int', { type: 'integer' } as any)).toBe('NUMBER(10)');
    expect(oracleColumnType(TABLE_THREADS, 'big', { type: 'bigint' } as any)).toBe('NUMBER(20)');
    expect(oracleColumnType(TABLE_THREADS, 'float', { type: 'float' } as any)).toBe('BINARY_DOUBLE');
    expect(oracleColumnType(TABLE_THREADS, 'flag', { type: 'boolean' } as any)).toBe('NUMBER(1)');
    expect(oracleColumnType(TABLE_THREADS, 'unknown', { type: 'unknown' } as any)).toBe('VARCHAR2(4000)');
  });

  it('generates composite primary keys, references, and reserved column names', () => {
    const tableSql = generateOracleTableSQL({
      tableName: TABLE_RESOURCES,
      schema: {
        id: { type: 'text' },
        parentId: { type: 'text', references: { table: TABLE_THREADS, column: 'id' } },
        metadata: { type: 'jsonb', nullable: true },
        size: { type: 'integer', nullable: true },
      } as any,
      schemaName: 'APP',
      compositePrimaryKey: ['id', 'parentId'],
    });

    expect(tableSql).toContain('PRIMARY KEY (id, "parentId")');
    expect(tableSql).toContain('REFERENCES "APP"."MASTRA_THREADS" (id)');
    expect(tableSql).toContain('"size" NUMBER(10)');
  });
});

describe('Oracle storage index DDL', () => {
  it('generates default-safe indexes with Oracle identifier mapping', () => {
    expect(
      generateOracleIndexSQL({
        name: 'idx_threads_resource_created',
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      }),
    ).toBe('CREATE INDEX "IDX_THREADS_RESOURCE_CREATED" ON "MASTRA_THREADS" ("resourceId", "createdAt" DESC)');
  });

  it('generates Oracle-native function-based indexes', () => {
    expect(
      generateOracleIndexSQL(
        {
          name: 'idx_workflow_status',
          table: TABLE_WORKFLOW_SNAPSHOT,
          columns: ["JSON_VALUE(snapshot, '$.status' RETURNING VARCHAR2(64) NULL ON ERROR)", 'run_id'],
          online: true,
          parallel: 2,
          invisible: true,
          compress: true,
        },
        'app_schema',
      ),
    ).toBe(
      'CREATE INDEX "APP_SCHEMA"."IDX_WORKFLOW_STATUS" ON "APP_SCHEMA"."MASTRA_WORKFLOW_SNAPSHOT" (JSON_VALUE(snapshot, \'$.status\' RETURNING VARCHAR2(64) NULL ON ERROR), run_id) COMPRESS PARALLEL 2 ONLINE INVISIBLE',
    );
  });

  it('emulates partial indexes with Oracle CASE expressions', () => {
    expect(
      generateOracleIndexSQL({
        name: 'idx_active_messages',
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt DESC'],
        where: "JSON_VALUE(metadata, '$.status' RETURNING VARCHAR2(32) NULL ON ERROR) = 'active'",
      }),
    ).toBe(
      "CREATE INDEX \"IDX_ACTIVE_MESSAGES\" ON \"MASTRA_MESSAGES\" (CASE WHEN (JSON_VALUE(metadata, '$.status' RETURNING VARCHAR2(32) NULL ON ERROR) = 'active') THEN thread_id END, CASE WHEN (JSON_VALUE(metadata, '$.status' RETURNING VARCHAR2(32) NULL ON ERROR) = 'active') THEN \"createdAt\" END DESC)",
    );
  });

  it('rejects unsafe expression fragments', () => {
    expect(() =>
      generateOracleIndexSQL({
        name: 'idx_bad',
        table: TABLE_MESSAGES,
        columns: ['thread_id); DROP TABLE mastra_messages; --'],
      }),
    ).toThrow(/unsafe SQL/i);
  });

  it('rejects bitmap indexes that try to emulate partial indexes', () => {
    expect(() =>
      generateOracleIndexSQL({
        name: 'idx_bad_bitmap',
        table: TABLE_MESSAGES,
        columns: ['role'],
        type: 'bitmap',
        where: "role = 'user'",
      }),
    ).toThrow(/bitmap/i);
  });

  it('uses selected Mastra core schemas to resolve camelCase index columns', () => {
    expect(
      generateOracleIndexSQL({
        name: 'idx_mcp_client_versions_client_version',
        table: TABLE_MCP_CLIENT_VERSIONS,
        columns: ['mcpClientId', 'versionNumber'],
        unique: true,
      }),
    ).toBe(
      'CREATE UNIQUE INDEX "IDX_MCP_CLIENT_VERSIONS_CLIENT_VERSION" ON "MASTRA_MCP_CLIENT_VERSIONS" ("mcpClientId", "versionNumber")',
    );
  });

  it('generates Oracle-specific index attributes and filters custom indexes by managed table', () => {
    expect(
      generateOracleIndexSQL({
        name: 'idx_bitmap',
        table: TABLE_THREADS,
        columns: ['resourceId DESC'],
        type: 'bitmap',
      } as any),
    ).toContain('CREATE BITMAP INDEX');
    expect(
      generateOracleIndexSQL(
        {
          name: 'idx_full',
          table: TABLE_THREADS,
          columns: ['resourceId ASC', "JSON_VALUE(metadata, '$.topic' RETURNING VARCHAR2(4000)) DESC"],
          unique: true,
          online: true,
          invisible: true,
          parallel: 2,
          compress: 1,
          noLogging: true,
          reverse: true,
          tablespace: 'USERS',
          where: 'title IS NOT NULL',
        } as any,
        'APP',
      ),
    ).toContain('COMPRESS 1 TABLESPACE USERS NOLOGGING PARALLEL 2 REVERSE ONLINE INVISIBLE');
    expect(
      generateOracleIndexSQL({
        name: 'idx_bool_attrs',
        table: TABLE_THREADS,
        columns: ['"createdAt"'],
        parallel: true,
        compress: true,
      } as any),
    ).toContain('COMPRESS PARALLEL');
    expect(
      generateOracleIndexSQL({
        name: 'idx_custom_plain',
        table: 'custom_table' as any,
        columns: ['plain ASC'],
        tablespace: 'USERS',
      }),
    ).toBe('CREATE INDEX "IDX_CUSTOM_PLAIN" ON "CUSTOM_TABLE" (PLAIN ASC) TABLESPACE USERS');

    expect(filterIndexesForTables(undefined, [TABLE_THREADS])).toEqual([]);
    expect(filterIndexesForTables([], [TABLE_THREADS])).toEqual([]);
    expect(
      filterIndexesForTables(
        [
          { name: 'keep', table: TABLE_THREADS, columns: ['id'] },
          { name: 'drop', table: TABLE_MESSAGES, columns: ['id'] },
        ] as any,
        [TABLE_THREADS],
      ),
    ).toHaveLength(1);
  });

  it('rejects invalid Oracle index options and expressions', () => {
    expect(() => generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: [] } as any)).toThrow(
      /at least one/i,
    );
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['id'], unique: true, type: 'bitmap' } as any),
    ).toThrow(/unique and bitmap/i);
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['id'], reverse: true, type: 'bitmap' } as any),
    ).toThrow(/reverse and bitmap/i);
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['id'], where: 'DROP TABLE x' } as any),
    ).toThrow(/unsafe SQL/i);
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['id'], parallel: 0 } as any),
    ).toThrow(/positive safe integer/i);
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['id'], compress: 0 } as any),
    ).toThrow(/positive safe integer/i);
    expect(() => generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: [''] } as any)).toThrow(
      /cannot be empty/i,
    );
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['LOWER(title'] } as any),
    ).toThrow(/unbalanced/i);
    expect(() =>
      generateOracleIndexSQL({ name: 'bad', table: TABLE_THREADS, columns: ['LOWER(title))'] } as any),
    ).toThrow(/unbalanced/i);
  });
});
