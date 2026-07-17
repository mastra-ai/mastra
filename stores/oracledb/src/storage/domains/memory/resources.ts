import { MastraError } from '@mastra/core/error';
import type { StorageResourceType } from '@mastra/core/storage';
import { TABLE_RESOURCES } from '@mastra/core/storage';
import type { Connection } from 'oracledb';

import { executeOptions, jsonBind, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { toDate } from '../../domain-utils';
import { RESOURCE_CREATED_AT, RESOURCE_UPDATED_AT, RESOURCE_WORKING_MEMORY } from './schema';
import { optionalClobStringBind, parseJson, parseOptionalString, storageError, table } from './utils';
import type { MemoryContext } from './utils';

// Resource working memory: one row per resourceId, upserted the same way
// threads are (title/metadata may not be known until after the first message).

type ResourceRow = {
  id: string;
  workingMemory?: unknown;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function getResourceById(
  ctx: MemoryContext,
  { resourceId }: { resourceId: string },
): Promise<StorageResourceType | null> {
  try {
    return await ctx.db.withConnection(async connection => {
      const result = await connection.execute<ObjectRow>(
        `${resourceSelect()} FROM ${table(ctx, TABLE_RESOURCES)} WHERE id = :resourceId`,
        { resourceId },
        executeOptions(),
      );
      const row = rows(result)[0] as ResourceRow | undefined;
      return row ? parseResource(row) : null;
    });
  } catch (error) {
    throw storageError('GET_RESOURCE_BY_ID', 'FAILED', { resourceId }, error);
  }
}

export async function saveResource(
  ctx: MemoryContext,
  { resource }: { resource: StorageResourceType },
): Promise<StorageResourceType> {
  try {
    await ctx.db.none(
      `
          MERGE INTO ${table(ctx, TABLE_RESOURCES)} target
          USING (
            SELECT
              :id AS id,
              :workingMemory AS working_memory,
              :metadata AS metadata,
              :createdAt AS created_at,
              :updatedAt AS updated_at
            FROM dual
          ) source
          ON (target.id = source.id)
          WHEN MATCHED THEN UPDATE SET
            target.${RESOURCE_WORKING_MEMORY} = source.working_memory,
            target.metadata = source.metadata,
            target.${RESOURCE_UPDATED_AT} = source.updated_at
          WHEN NOT MATCHED THEN INSERT (
            id,
            ${RESOURCE_WORKING_MEMORY},
            metadata,
            ${RESOURCE_CREATED_AT},
            ${RESOURCE_UPDATED_AT}
          ) VALUES (
            source.id,
            source.working_memory,
            source.metadata,
            source.created_at,
            source.updated_at
          )`,
      {
        id: resource.id,
        workingMemory: optionalClobStringBind(resource.workingMemory),
        metadata: jsonBind(resource.metadata ?? {}),
        createdAt: resource.createdAt ?? new Date(),
        updatedAt: resource.updatedAt ?? new Date(),
      },
    );
    return resource;
  } catch (error) {
    throw storageError('SAVE_RESOURCE', 'FAILED', { resourceId: resource.id }, error);
  }
}

export async function updateResource(
  ctx: MemoryContext,
  {
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<StorageResourceType> {
  const existing = await ctx.getResourceById({ resourceId });
  if (!existing) {
    const resource: StorageResourceType = {
      id: resourceId,
      workingMemory,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return ctx.saveResource({ resource });
  }

  try {
    return await ctx.db.tx(async (_client, connection) => {
      // Re-read under FOR UPDATE so a concurrent updateResource on the same id
      // cannot interleave between this lock and the MERGE below, which would
      // otherwise let one writer's workingMemory/metadata clobber the other's.
      const result = await connection.execute<ObjectRow>(
        `${resourceSelect()} FROM ${table(ctx, TABLE_RESOURCES)} WHERE id = :resourceId FOR UPDATE`,
        { resourceId },
        executeOptions(),
      );
      const row = rows(result)[0] as ResourceRow | undefined;
      const locked = row ? parseResource(row) : existing;

      const updated: StorageResourceType = {
        ...locked,
        workingMemory: workingMemory !== undefined ? workingMemory : locked.workingMemory,
        metadata: metadata ? { ...(locked.metadata ?? {}), ...metadata } : locked.metadata,
        updatedAt: new Date(),
      };

      await mergeResourceRow(ctx, connection, updated);
      return updated;
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_RESOURCE', 'FAILED', { resourceId }, error);
  }
}

/**
 * Upserts one resource row against the given raw connection. Shared by
 * `saveResource` (auto-commit) and `updateResource`, which runs this inside
 * the SAME transaction as the FOR UPDATE lock above, so the merge sees and
 * replaces exactly the row it locked.
 */
async function mergeResourceRow(
  ctx: Pick<MemoryContext, 'schemaName'>,
  connection: Connection,
  resource: StorageResourceType,
): Promise<void> {
  await connection.execute(
    `
        MERGE INTO ${table(ctx, TABLE_RESOURCES)} target
        USING (
          SELECT
            :id AS id,
            :workingMemory AS working_memory,
            :metadata AS metadata,
            :createdAt AS created_at,
            :updatedAt AS updated_at
          FROM dual
        ) source
        ON (target.id = source.id)
        WHEN MATCHED THEN UPDATE SET
          target.${RESOURCE_WORKING_MEMORY} = source.working_memory,
          target.metadata = source.metadata,
          target.${RESOURCE_UPDATED_AT} = source.updated_at
        WHEN NOT MATCHED THEN INSERT (
          id,
          ${RESOURCE_WORKING_MEMORY},
          metadata,
          ${RESOURCE_CREATED_AT},
          ${RESOURCE_UPDATED_AT}
        ) VALUES (
          source.id,
          source.working_memory,
          source.metadata,
          source.created_at,
          source.updated_at
        )`,
    {
      id: resource.id,
      workingMemory: optionalClobStringBind(resource.workingMemory),
      metadata: jsonBind(resource.metadata ?? {}),
      createdAt: resource.createdAt ?? new Date(),
      updatedAt: resource.updatedAt ?? new Date(),
    },
  );
}

function parseResource(row: ResourceRow): StorageResourceType {
  const workingMemory = parseOptionalString(row.workingMemory);
  return {
    id: String(row.id),
    workingMemory,
    metadata: parseJson(row.metadata),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function resourceSelect(): string {
  return `SELECT id AS "id", ${RESOURCE_WORKING_MEMORY} AS "workingMemory", metadata AS "metadata", ${RESOURCE_CREATED_AT} AS "createdAt", ${RESOURCE_UPDATED_AT} AS "updatedAt"`;
}
