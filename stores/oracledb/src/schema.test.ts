import {
  TABLE_AGENTS,
  TABLE_MCP_CLIENTS,
  TABLE_SCORER_DEFINITIONS,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { exportSchemas } from './schema';

describe('Oracle schema export', () => {
  it('exports schema-qualified storage DDL and vector registry DDL by default', () => {
    const ddl = exportSchemas({ schemaName: 'app_schema' });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_ORACLE_MIGRATIONS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_THREADS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_WORKFLOW_SNAPSHOT"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_AI_SPANS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_LOG_EVENTS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_SCORERS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_SCORER_DEFINITIONS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_MCP_CLIENTS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_AGENTS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_VECTOR_INDEXES"');
  });

  it('exports vector table, registry row, metadata indexes, and explicit IVF DDL', () => {
    const ddl = exportSchemas({
      schemaName: 'app_schema',
      domains: ['vector'],
      vector: {
        tablePrefix: 'APP_VEC',
        indexes: [
          {
            indexName: 'memory_messages_1536',
            dimension: 1536,
            indexConfig: { type: 'ivf', accuracy: 90, ivf: { neighborPartitions: 4 } },
            metadataIndexes: ['resource_id'],
          },
        ],
      },
    });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."APP_VEC_MEMORY_MESSAGES_1536"');
    expect(ddl).toContain('MERGE INTO "APP_SCHEMA"."MASTRA_VECTOR_INDEXES"');
    expect(ddl).toContain("'ivf' AS index_type");
    expect(ddl).toContain("JSON_VALUE(metadata, '$.resource_id' RETURNING VARCHAR2(4000) NULL ON ERROR)");
    expect(ddl).toContain('CREATE VECTOR INDEX "APP_SCHEMA"."APP_VEC_MEMORY_MESSAGES_1536_VECTOR_IDX"');
    expect(ddl).toContain('PARAMETERS (type IVF, neighbor partitions 4)');
    expect(ddl).not.toContain('MASTRA_ORACLE_MIGRATIONS');
  });

  it('exports deferred vector index registry rows as exact physical indexes', () => {
    const ddl = exportSchemas({
      domains: ['vector'],
      vector: {
        indexes: [
          {
            indexName: 'deferred_vectors',
            dimension: 3,
            indexConfig: { type: 'ivf', accuracy: 90, ivf: { neighborPartitions: 1 } },
            buildIndex: false,
          },
        ],
      },
    });

    expect(ddl).toContain("'none' AS index_type");
    expect(ddl).toContain('95 AS accuracy');
    expect(ddl).not.toContain('90 AS accuracy');
    expect(ddl).not.toContain('CREATE VECTOR INDEX');
  });

  it('exports vector DDL without metadata indexes when explicitly disabled', () => {
    const ddl = exportSchemas({
      domains: ['vector'],
      vector: {
        indexes: [
          {
            indexName: 'plain_vectors',
            dimension: 3,
            metadataIndexes: [],
          },
        ],
      },
    });

    expect(ddl).toContain('CREATE TABLE "MASTRA_VEC_PLAIN_VECTORS"');
    expect(ddl).toContain("'cosine' AS metric");
    expect(ddl).not.toContain('JSON_VALUE(metadata');
  });

  it('omits default storage indexes when requested', () => {
    const ddl = exportSchemas({
      domains: ['memory'],
      skipDefaultIndexes: true,
    });

    expect(ddl).toContain('CREATE TABLE "MASTRA_MESSAGES"');
    expect(ddl).not.toContain('CREATE INDEX');
  });

  it('omits default indexes for all selected non-memory storage domains when requested', () => {
    const ddl = exportSchemas({
      domains: ['workflows', 'observability', 'scores', 'scorerDefinitions', 'mcpClients', 'agents'],
      skipDefaultIndexes: true,
    });

    expect(ddl).toContain('CREATE TABLE "MASTRA_WORKFLOW_SNAPSHOT"');
    expect(ddl).toContain('CREATE TABLE "MASTRA_AI_SPANS"');
    expect(ddl).toContain('CREATE TABLE "MASTRA_SCORERS"');
    expect(ddl).toContain('CREATE TABLE "MASTRA_SCORER_DEFINITIONS"');
    expect(ddl).toContain('CREATE TABLE "MASTRA_MCP_CLIENTS"');
    expect(ddl).toContain('CREATE TABLE "MASTRA_AGENTS"');
    expect(ddl).not.toContain('CREATE INDEX');
    expect(ddl).not.toContain('CREATE UNIQUE INDEX');
  });

  it('exports observability spans, log events, and indexes', () => {
    const ddl = exportSchemas({
      schemaName: 'app_schema',
      domains: ['observability'],
    });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_AI_SPANS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_LOG_EVENTS"');
    expect(ddl).toContain('PRIMARY KEY ("traceId", "spanId")');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."MASTRA_AI_SPANS_TRACEID_STARTEDAT_IDX"');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."MASTRA_LOG_EVENTS_TIMESTAMP_IDX"');
  });

  it('exports agents DDL, default indexes, and custom indexes', () => {
    const ddl = exportSchemas({
      schemaName: 'app_schema',
      domains: ['agents'],
      indexes: [
        {
          name: 'AGENT_CATEGORY_IDX',
          table: TABLE_AGENTS,
          columns: ["JSON_VALUE(metadata, '$.category' RETURNING VARCHAR2(128) NULL ON ERROR)", 'createdAt DESC'],
        },
      ],
    });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_AGENTS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_AGENT_VERSIONS"');
    expect(ddl).toContain('instructions CLOB NOT NULL');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."MASTRA_AGENTS_STATUS_CREATED_IDX"');
    expect(ddl).toContain('CREATE UNIQUE INDEX "APP_SCHEMA"."MASTRA_AGENT_VERSIONS_AGENT_VERSION_IDX"');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."AGENT_CATEGORY_IDX"');
  });

  it('exports scorer definitions DDL, default unique index, and custom indexes', () => {
    const ddl = exportSchemas({
      schemaName: 'app_schema',
      domains: ['scorerDefinitions'],
      indexes: [
        {
          name: 'SCORER_DEFINITION_CATEGORY_IDX',
          table: TABLE_SCORER_DEFINITIONS,
          columns: ["JSON_VALUE(metadata, '$.category' RETURNING VARCHAR2(128) NULL ON ERROR)", 'createdAt DESC'],
        },
      ],
    });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_SCORER_DEFINITIONS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_SCORER_DEFINITION_VERSIONS"');
    expect(ddl).toContain('CREATE UNIQUE INDEX "APP_SCHEMA"."MASTRA_SCORER_DEFINITION_VERSIONS_DEF_VERSION_IDX"');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."SCORER_DEFINITION_CATEGORY_IDX"');
  });

  it('exports MCP clients DDL, default unique index, and custom indexes', () => {
    const ddl = exportSchemas({
      schemaName: 'app_schema',
      domains: ['mcpClients'],
      indexes: [
        {
          name: 'MCP_CLIENT_CATEGORY_IDX',
          table: TABLE_MCP_CLIENTS,
          columns: ["JSON_VALUE(metadata, '$.category' RETURNING VARCHAR2(128) NULL ON ERROR)", 'createdAt DESC'],
        },
      ],
    });

    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_MCP_CLIENTS"');
    expect(ddl).toContain('CREATE TABLE "APP_SCHEMA"."MASTRA_MCP_CLIENT_VERSIONS"');
    expect(ddl).toContain('servers JSON NOT NULL');
    expect(ddl).toContain('CREATE UNIQUE INDEX "APP_SCHEMA"."MASTRA_MCP_CLIENT_VERSIONS_CLIENT_VERSION_IDX"');
    expect(ddl).toContain('CREATE INDEX "APP_SCHEMA"."MCP_CLIENT_CATEGORY_IDX"');
  });
});
