import {
  TABLE_AGENT_VERSIONS,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { generateOracleIndexSQL, generateOracleTableSQL, oracleColumnType, parseOracleJson } from '.';

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
});
