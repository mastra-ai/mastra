import { TABLE_MESSAGES, TABLE_OBSERVATIONAL_MEMORY, TABLE_RESOURCES, TABLE_THREADS } from '@mastra/core/storage';
import type { Connection } from 'oracledb';

import { executeDdl, asBindParameters, executeOptions, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { indexNameForTable } from '../../../vector/identifiers';
import { createOracleIndex } from '../../db';
import type { OracleCreateIndexOptions } from '../../db';
import { table } from './utils';
import type { MemoryContext } from './utils';

// DDL and quoted-column identifiers for every table the memory domain owns
// (threads, messages, resources, observational memory). Column name constants
// live here so threads.ts/messages.ts/resources.ts/observational*.ts all agree
// on the physical schema.
export const THREAD_RESOURCE_ID = '"resourceId"';
export const THREAD_CREATED_AT = '"createdAt"';
export const THREAD_UPDATED_AT = '"updatedAt"';
export const MESSAGE_RESOURCE_ID = '"resourceId"';
export const MESSAGE_CREATED_AT = '"createdAt"';
export const RESOURCE_WORKING_MEMORY = '"workingMemory"';
export const RESOURCE_CREATED_AT = '"createdAt"';
export const RESOURCE_UPDATED_AT = '"updatedAt"';
export const OM_LOOKUP_KEY = '"lookupKey"';
export const OM_SCOPE = '"scope"';
export const OM_RESOURCE_ID = '"resourceId"';
export const OM_THREAD_ID = '"threadId"';
export const OM_ACTIVE_OBSERVATIONS = '"activeObservations"';
export const OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE = '"activeObservationsPendingUpdate"';
export const OM_ORIGIN_TYPE = '"originType"';
export const OM_GENERATION_COUNT = '"generationCount"';
export const OM_LAST_OBSERVED_AT = '"lastObservedAt"';
export const OM_LAST_REFLECTION_AT = '"lastReflectionAt"';
export const OM_PENDING_MESSAGE_TOKENS = '"pendingMessageTokens"';
export const OM_TOTAL_TOKENS_OBSERVED = '"totalTokensObserved"';
export const OM_OBSERVATION_TOKEN_COUNT = '"observationTokenCount"';
export const OM_IS_OBSERVING = '"isObserving"';
export const OM_IS_REFLECTING = '"isReflecting"';
export const OM_OBSERVED_MESSAGE_IDS = '"observedMessageIds"';
export const OM_OBSERVED_TIMEZONE = '"observedTimezone"';
export const OM_BUFFERED_OBSERVATIONS = '"bufferedObservations"';
export const OM_BUFFERED_OBSERVATION_TOKENS = '"bufferedObservationTokens"';
export const OM_BUFFERED_MESSAGE_IDS = '"bufferedMessageIds"';
export const OM_BUFFERED_REFLECTION = '"bufferedReflection"';
export const OM_BUFFERED_REFLECTION_TOKENS = '"bufferedReflectionTokens"';
export const OM_BUFFERED_REFLECTION_INPUT_TOKENS = '"bufferedReflectionInputTokens"';
export const OM_REFLECTED_OBSERVATION_LINE_COUNT = '"reflectedObservationLineCount"';
export const OM_BUFFERED_OBSERVATION_CHUNKS = '"bufferedObservationChunks"';
export const OM_IS_BUFFERING_OBSERVATION = '"isBufferingObservation"';
export const OM_IS_BUFFERING_REFLECTION = '"isBufferingReflection"';
export const OM_LAST_BUFFERED_AT_TOKENS = '"lastBufferedAtTokens"';
export const OM_LAST_BUFFERED_AT_TIME = '"lastBufferedAtTime"';
export const OM_CREATED_AT = '"createdAt"';
export const OM_UPDATED_AT = '"updatedAt"';

export async function initMemorySchema(ctx: MemoryContext): Promise<void> {
  await ctx.db.withConnection(async connection => {
    // Use one connection for table, column, and index setup so schema-qualified
    // deployments see a consistent Oracle session throughout initialization.
    await createTables(ctx, connection);
    await createIndexes(ctx, connection);
  });
}

export async function clearAllMemoryTables(ctx: MemoryContext): Promise<void> {
  await ctx.db.tx(async client => {
    await client.none(`DELETE FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}`);
    await client.none(`DELETE FROM ${table(ctx, TABLE_MESSAGES)}`);
    await client.none(`DELETE FROM ${table(ctx, TABLE_THREADS)}`);
    await client.none(`DELETE FROM ${table(ctx, TABLE_RESOURCES)}`);
  });
}

async function createTables(ctx: MemoryContext, connection: Connection): Promise<void> {
  // Memory table DDL is kept manual instead of relying only on TABLE_SCHEMAS
  // because Oracle-specific CLOB/JSON choices are central to this provider.
  await executeDdl(
    connection,
    `
    CREATE TABLE ${table(ctx, TABLE_RESOURCES)} (
      id VARCHAR2(512) PRIMARY KEY,
      ${RESOURCE_WORKING_MEMORY} CLOB,
      metadata JSON,
      ${RESOURCE_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
      ${RESOURCE_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
    )`,
    [-955],
  );

  await executeDdl(
    connection,
    `
    CREATE TABLE ${table(ctx, TABLE_THREADS)} (
      id VARCHAR2(512) PRIMARY KEY,
      ${THREAD_RESOURCE_ID} VARCHAR2(512) NOT NULL,
      title VARCHAR2(1024),
      metadata JSON,
      ${THREAD_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
      ${THREAD_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
    )`,
    [-955],
  );

  await relaxThreadTitleNullability(ctx, connection);

  await executeDdl(
    connection,
    `
    CREATE TABLE ${table(ctx, TABLE_MESSAGES)} (
      id VARCHAR2(512) PRIMARY KEY,
      thread_id VARCHAR2(512) NOT NULL,
      content CLOB NOT NULL,
      role VARCHAR2(64) NOT NULL,
      type VARCHAR2(64) NOT NULL,
      ${MESSAGE_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
      ${MESSAGE_RESOURCE_ID} VARCHAR2(512)
    )`,
    [-955],
  );
  await executeDdl(connection, `ALTER TABLE ${table(ctx, TABLE_MESSAGES)} ADD (${MESSAGE_RESOURCE_ID} VARCHAR2(512))`, [
    -1430,
  ]);

  await executeDdl(
    connection,
    `
    CREATE TABLE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} (
      id VARCHAR2(512) PRIMARY KEY,
      ${OM_LOOKUP_KEY} VARCHAR2(1024) NOT NULL,
      ${OM_SCOPE} VARCHAR2(32) NOT NULL,
      ${OM_RESOURCE_ID} VARCHAR2(512) NOT NULL,
      ${OM_THREAD_ID} VARCHAR2(512),
      ${OM_ACTIVE_OBSERVATIONS} CLOB,
      ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE} CLOB,
      ${OM_ORIGIN_TYPE} VARCHAR2(32) NOT NULL,
      config JSON NOT NULL,
      ${OM_GENERATION_COUNT} NUMBER(10) DEFAULT 0 NOT NULL,
      ${OM_LAST_OBSERVED_AT} TIMESTAMP WITH TIME ZONE,
      ${OM_LAST_REFLECTION_AT} TIMESTAMP WITH TIME ZONE,
      ${OM_PENDING_MESSAGE_TOKENS} NUMBER(20) DEFAULT 0 NOT NULL,
      ${OM_TOTAL_TOKENS_OBSERVED} NUMBER(20) DEFAULT 0 NOT NULL,
      ${OM_OBSERVATION_TOKEN_COUNT} NUMBER(20) DEFAULT 0 NOT NULL,
      ${OM_IS_OBSERVING} NUMBER(1) DEFAULT 0 NOT NULL,
      ${OM_IS_REFLECTING} NUMBER(1) DEFAULT 0 NOT NULL,
      ${OM_OBSERVED_MESSAGE_IDS} JSON,
      ${OM_OBSERVED_TIMEZONE} VARCHAR2(128),
      ${OM_BUFFERED_OBSERVATIONS} CLOB,
      ${OM_BUFFERED_OBSERVATION_TOKENS} NUMBER(20),
      ${OM_BUFFERED_MESSAGE_IDS} JSON,
      ${OM_BUFFERED_REFLECTION} CLOB,
      ${OM_BUFFERED_REFLECTION_TOKENS} NUMBER(20),
      ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} NUMBER(20),
      ${OM_REFLECTED_OBSERVATION_LINE_COUNT} NUMBER(20),
      ${OM_BUFFERED_OBSERVATION_CHUNKS} JSON,
      ${OM_IS_BUFFERING_OBSERVATION} NUMBER(1) DEFAULT 0 NOT NULL,
      ${OM_IS_BUFFERING_REFLECTION} NUMBER(1) DEFAULT 0 NOT NULL,
      ${OM_LAST_BUFFERED_AT_TOKENS} NUMBER(20) DEFAULT 0 NOT NULL,
      ${OM_LAST_BUFFERED_AT_TIME} TIMESTAMP WITH TIME ZONE,
      metadata JSON,
      ${OM_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
      ${OM_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
    )`,
    [-955],
  );

  await ensureObservationalMemoryColumns(ctx, connection);
  await relaxObservationalMemoryNullability(ctx, connection);
}

async function ensureObservationalMemoryColumns(ctx: MemoryContext, connection: Connection): Promise<void> {
  // Observational memory evolved after basic memory storage. This additive
  // pass lets older Oracle schemas upgrade in place without dropping data.
  const columns = [
    { name: OM_LOOKUP_KEY, type: 'VARCHAR2(1024)' },
    { name: OM_SCOPE, type: 'VARCHAR2(32)' },
    { name: OM_RESOURCE_ID, type: 'VARCHAR2(512)' },
    { name: OM_THREAD_ID, type: 'VARCHAR2(512)' },
    { name: OM_ACTIVE_OBSERVATIONS, type: 'CLOB' },
    { name: OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE, type: 'CLOB' },
    { name: OM_ORIGIN_TYPE, type: 'VARCHAR2(32)' },
    { name: 'config', type: 'JSON' },
    { name: OM_GENERATION_COUNT, type: 'NUMBER(10) DEFAULT 0' },
    { name: OM_LAST_OBSERVED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
    { name: OM_LAST_REFLECTION_AT, type: 'TIMESTAMP WITH TIME ZONE' },
    { name: OM_PENDING_MESSAGE_TOKENS, type: 'NUMBER(20) DEFAULT 0' },
    { name: OM_TOTAL_TOKENS_OBSERVED, type: 'NUMBER(20) DEFAULT 0' },
    { name: OM_OBSERVATION_TOKEN_COUNT, type: 'NUMBER(20) DEFAULT 0' },
    { name: OM_IS_OBSERVING, type: 'NUMBER(1) DEFAULT 0' },
    { name: OM_IS_REFLECTING, type: 'NUMBER(1) DEFAULT 0' },
    { name: OM_OBSERVED_MESSAGE_IDS, type: 'JSON' },
    { name: OM_OBSERVED_TIMEZONE, type: 'VARCHAR2(128)' },
    { name: OM_BUFFERED_OBSERVATIONS, type: 'CLOB' },
    { name: OM_BUFFERED_OBSERVATION_TOKENS, type: 'NUMBER(20)' },
    { name: OM_BUFFERED_MESSAGE_IDS, type: 'JSON' },
    { name: OM_BUFFERED_REFLECTION, type: 'CLOB' },
    { name: OM_BUFFERED_REFLECTION_TOKENS, type: 'NUMBER(20)' },
    { name: OM_BUFFERED_REFLECTION_INPUT_TOKENS, type: 'NUMBER(20)' },
    { name: OM_REFLECTED_OBSERVATION_LINE_COUNT, type: 'NUMBER(20)' },
    { name: OM_BUFFERED_OBSERVATION_CHUNKS, type: 'JSON' },
    { name: OM_IS_BUFFERING_OBSERVATION, type: 'NUMBER(1) DEFAULT 0' },
    { name: OM_IS_BUFFERING_REFLECTION, type: 'NUMBER(1) DEFAULT 0' },
    { name: OM_LAST_BUFFERED_AT_TOKENS, type: 'NUMBER(20) DEFAULT 0' },
    { name: OM_LAST_BUFFERED_AT_TIME, type: 'TIMESTAMP WITH TIME ZONE' },
    { name: 'metadata', type: 'JSON' },
    { name: OM_CREATED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
    { name: OM_UPDATED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
  ];

  for (const column of columns) {
    await executeDdl(
      connection,
      `ALTER TABLE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} ADD (${column.name} ${column.type})`,
      [-1430],
    );
  }
}

async function relaxThreadTitleNullability(ctx: MemoryContext, connection: Connection): Promise<void> {
  const tableName = TABLE_THREADS.toUpperCase();
  const result = ctx.schemaName
    ? await connection.execute<ObjectRow>(
        `SELECT nullable AS "nullable" FROM all_tab_columns WHERE owner = :owner AND table_name = :tableName AND column_name = 'TITLE'`,
        asBindParameters({ owner: ctx.schemaName, tableName }),
        executeOptions(),
      )
    : await connection.execute<ObjectRow>(
        `SELECT nullable AS "nullable" FROM user_tab_columns WHERE table_name = :tableName AND column_name = 'TITLE'`,
        asBindParameters({ tableName }),
        executeOptions(),
      );

  if (String(rows(result)[0]?.nullable ?? 'Y').toUpperCase() !== 'N') return;

  await executeDdl(connection, `ALTER TABLE ${table(ctx, TABLE_THREADS)} MODIFY (title NULL)`, [-1451, -54]);
}

async function relaxObservationalMemoryNullability(ctx: MemoryContext, connection: Connection): Promise<void> {
  await executeDdl(
    connection,
    `ALTER TABLE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} MODIFY (${OM_ACTIVE_OBSERVATIONS} NULL)`,
    [-1451, -54],
  );
}

async function createIndexes(ctx: MemoryContext, connection: Connection): Promise<void> {
  if (!ctx.skipDefaultIndexes) {
    for (const index of defaultIndexes(ctx)) {
      try {
        await createOracleIndex(connection, index, ctx.schemaName);
      } catch (error) {
        ctx.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
      }
    }
  }

  for (const index of ctx.indexes) {
    await createOracleIndex(connection, index, ctx.schemaName);
  }
}

function indexName(name: string): string {
  return indexNameForTable(name, 'IDX');
}

function defaultIndexes(_ctx: MemoryContext): OracleCreateIndexOptions[] {
  return [
    {
      name: indexName('MASTRA_THREADS_RESOURCE_CREATED_IDX'),
      table: TABLE_THREADS,
      columns: ['resourceId', 'createdAt'],
    },
    {
      name: indexName('MASTRA_MESSAGES_THREAD_CREATED_IDX'),
      table: TABLE_MESSAGES,
      columns: ['thread_id', 'createdAt'],
    },
    {
      name: indexName('MASTRA_MESSAGES_RESOURCE_CREATED_IDX'),
      table: TABLE_MESSAGES,
      columns: ['resourceId', 'createdAt'],
    },
    {
      name: indexName('MASTRA_OM_LOOKUP_GENERATION_IDX'),
      table: TABLE_OBSERVATIONAL_MEMORY,
      columns: ['lookupKey', 'generationCount'],
    },
    {
      name: indexName('MASTRA_OM_RESOURCE_CREATED_IDX'),
      table: TABLE_OBSERVATIONAL_MEMORY,
      columns: ['resourceId', 'createdAt'],
    },
    {
      name: indexName('MASTRA_OM_THREAD_CREATED_IDX'),
      table: TABLE_OBSERVATIONAL_MEMORY,
      columns: ['threadId', 'createdAt'],
    },
  ];
}
