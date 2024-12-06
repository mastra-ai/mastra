import { MastraEngine, BaseEntity, BaseRecord, QueryOptions } from '@mastra/core';
import { eq, SQL, sql } from 'drizzle-orm';
import postgres from 'postgres';

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from './db/schema.js';

export class PostgresEngine implements MastraEngine {
  private driver: ReturnType<typeof postgres>;
  private db: PostgresJsDatabase<typeof schema>;
  constructor({ url }: { url: string }) {
    console.log('PostgresEngine');
    this.driver = postgres(url);
    this.db = drizzle({ client: this.driver, schema });
  }

  async close() {
    return this.driver.end();
  }

  async createEntity({ connectionId, name }: { name: string; connectionId: string }): Promise<BaseEntity> {
    const created = await this.db
      .insert(schema.entities)
      .values({
        name,
        connectionId,
      })
      .returning();

    if (!created[0]) {
      throw new Error('Failed to create entity');
    }

    const e = created?.[0];
    return e;
  }

  async getEntityById({ id }: { id: string }): Promise<BaseEntity> {
    const result = await this.db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, id),
    });

    if (!result) {
      throw new Error(`No entity found with id: ${id}`);
    }

    return result;
  }

  async getEntity({ name, connectionId }: { name: string; connectionId: string }) {
    const result = await this.db.query.entities.findMany({
      where: (entities, { and, eq }) => {
        let expressions: SQL[] = [];

        if (name) {
          const entityName = entities.name;
          const equality = eq(entityName, name);
          expressions.push(equality);
        }

        if (connectionId) {
          const entityConnectionId = entities.connectionId;
          const equality = eq(entityConnectionId, connectionId);
          expressions.push(equality);
        }

        return and(...expressions);
      },
    });

    return result?.[0];
  }

  async deleteEntityById({ id }: { id: string }): Promise<BaseEntity> {
    const deleted = await this.db.delete(schema.entities).where(eq(schema.entities.id, id)).returning();

    if (!deleted[0]) {
      throw new Error(`No entity found with id: ${id}`);
    }

    return deleted[0];
  }

  async getRecordsByEntityId({ entityId }: { entityId: string }): Promise<BaseRecord[]> {
    return this.db.query.records.findMany({
      where: (records, { eq }) => eq(records.entityId, entityId),
    });
  }

  async getRecordsByEntityName({ name, connectionId }: { name: string; connectionId: string }): Promise<BaseRecord[]> {
    const entity = await this.getEntity({ name, connectionId });

    if (!entity) {
      throw new Error(`Entity not found with name: ${name} and connectionId: ${connectionId}`);
    }

    return this.db.query.records.findMany({
      where: (records, { eq, and }) => and(eq(records.entityType, name), eq(records.entityId, entity.id!)),
    });
  }

  async updateEntityLastSyncId({ id, syncId }: { id: string; syncId: string }): Promise<BaseEntity> {
    const updated = await this.db
      .update(schema.entities)
      .set({
        lastSyncId: syncId,
      })
      .where(eq(schema.entities.id, id))
      .returning();

    if (!updated[0]) {
      throw new Error(`No entity found with id: ${id}`);
    }

    return updated[0];
  }

  async upsertRecords({ entityId, records }: { entityId: string; records: Pick<BaseRecord, 'externalId' | 'data'>[] }) {
    if (!records?.length) return;

    const entity = await this.getEntityById({ id: entityId });

    // Deduplicate records by externalId
    const uniqueRecordsMap = new Map<string, Pick<BaseRecord, 'externalId' | 'data'>>();
    for (const record of records) {
      if (record.externalId && !uniqueRecordsMap.has(record.externalId)) {
        uniqueRecordsMap.set(record.externalId, record);
      }
    }

    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    const externalIds = uniqueRecords.map(record => String(record.externalId));

    const existingRecords = await this.db
      .select({
        id: schema.records.id,
        externalId: schema.records.externalId,
        data: schema.records.data,
      })
      .from(schema.records)
      .where(
        sql`${schema.records.entityId} = ${entityId} AND ${schema.records.externalId} IN (${sql.join(externalIds, sql`, `)})`,
      );

    const toCreate: (typeof schema.records.$inferInsert)[] = [];
    const toUpdate: { externalId: string; data: Record<string, any> }[] = [];

    // Separate records into create and update arrays
    uniqueRecords.forEach(record => {
      const existing = existingRecords.find(existingRecord => existingRecord.externalId === String(record.externalId));

      if (existing) {
        toUpdate.push({
          externalId: String(record.externalId),
          data: {
            ...(existing.data as Object),
            ...record.data,
          },
        });
      } else {
        toCreate.push({
          externalId: String(record.externalId),
          entityId,
          entityType: entity.name,
          data: record.data,
        });
      }
    });

    const operations: Promise<any>[] = [];

    // Handle creations
    if (toCreate.length) {
      operations.push(this.db.insert(schema.records).values(toCreate));
    }

    // Handle updates
    if (toUpdate.length) {
      const updateQuery = sql`
      UPDATE ${schema.records} AS r
      SET data = x.new_data::jsonb
      FROM (
        VALUES
          ${sql.join(
            toUpdate.map(({ externalId, data }) => sql`(${externalId}, ${JSON.stringify(data)})`),
            sql`,`,
          )}
      ) AS x("externalId", new_data)
      WHERE r."externalId" = x."externalId"
      AND r."entityId" = ${entityId}
    `;

      operations.push(this.db.execute(updateQuery));
    }

    await Promise.all(operations);
  }

  async deleteRecordsByEntityId({ id }: { id: string }): Promise<BaseRecord[]> {
    const deleted = await this.db.delete(schema.records).where(eq(schema.records.entityId, id)).returning();

    if (!deleted[0]) {
      throw new Error(`No records found with id: ${id}`);
    }
    return deleted as BaseRecord[];
  }

  async syncData({
    connectionId,
    name,
    data,
    lastSyncId,
  }: {
    name: string;
    connectionId: string;
    data: Pick<BaseRecord, 'data' | 'externalId'>[];
    lastSyncId?: string;
  }) {
    const existingEntity = await this.getEntity({
      connectionId,
      name,
    });

    let entity = existingEntity;

    if (!entity) {
      entity = await this.createEntity({
        name,
        connectionId,
      });
    }

    await this.upsertRecords({
      entityId: entity?.id!,
      records: data,
    });

    if (lastSyncId) {
      await this.updateEntityLastSyncId({
        id: entity?.id!,
        syncId: lastSyncId,
      });
    }
  }

  async getRecords({
    entityName,
    connectionId,
    options,
  }: {
    entityName: string;
    options: QueryOptions;
    connectionId: string;
  }) {
    let query = '';

    const buildJsonPath = (path: string[]) => {
      // For single level path (e.g., "name")
      if (path.length === 1) {
        return `data ->> '${path[0]}'`;
      }

      // For multi-level paths (e.g., "address.city.zipcode")
      const lastField = path.pop();
      const jsonPath = path.reduce((acc, curr) => `${acc} -> '${curr}'`, 'data');
      return `${jsonPath} ->> '${lastField}'`;
    };

    // Handle JSON field filters
    if (options.filters) {
      options.filters.forEach(filter => {
        // In your switch case:
        const pathParts = filter.field.split('.');

        switch (filter.operator) {
          case 'eq':
            query += ` AND ${buildJsonPath(pathParts)} = '${filter.value}' `;
            break;
          case 'gt':
            query += ` AND (${buildJsonPath(pathParts)})::numeric > ${filter.value} `;
            break;
          case 'lt':
            query += ` AND (${buildJsonPath(pathParts)})::numeric < ${filter.value} `;
            break;
          case 'gte':
            query += ` AND (${buildJsonPath(pathParts)})::numeric >= ${filter.value} `;
            break;
          case 'lte':
            query += ` AND (${buildJsonPath(pathParts)})::numeric <= ${filter.value} `;
            break;
          case 'contains':
            query += ` AND ${buildJsonPath(pathParts)} ILIKE '%${filter.value}%' `;
            break;
          case 'in':
            query += ` AND ${buildJsonPath(pathParts)} = ANY(${filter.value}) `;
            break;
        }
      });
    }

    // Handle sorting
    if (options.sort && options.sort.length > 0) {
      const sortClauses = options.sort.map(sort => {
        const jsonPath = sort.field.split('.');
        return `${buildJsonPath(jsonPath)}${sort.field.includes('price') ? '::numeric' : ''} ${sort.direction}`;
      });
      query += ` ORDER BY ${sortClauses.join(', ')} `;
    }

    // Handle pagination
    if (options.limit) {
      query += ` LIMIT ${options.limit} `;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset} `;
    }

    const queryStr = `
      SELECT 
        "mastra"."records".*,
        row_to_json("mastra"."entity".*) AS "entity"
      FROM "mastra"."records"
      LEFT JOIN "mastra"."entity" ON "mastra"."entity"."id" = "mastra"."records"."entityId"
      WHERE entity."connectionId" = '${connectionId}' AND entity.name = '${entityName}' 
      ${query}
    `;

    return this.db.execute(queryStr) as unknown as BaseRecord[];
  }
}
