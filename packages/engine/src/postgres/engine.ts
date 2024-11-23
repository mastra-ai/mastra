import {
  MastraEngine,
  FilterObject,
  BaseConnection,
  BaseCredential,
  BaseEntity,
  BaseProperty,
  BaseRecord,
  CredentialInput,
  CredentialUpdateInput,
  CredentialWithConnection,
} from '@mastra/core';
import { and, eq, or, sql } from 'drizzle-orm';
import postgres from 'postgres';

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from './db/schema';
import { getFilterClauseSQL } from './query-builder/filters/sql';
import { getSortClauseSQL } from './query-builder/sorts/sql';

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

  async getConnection({ connectionId, name }: { name: string; connectionId: string }) {
    return (await this.db.query.connections.findFirst({
      where: (connections, { and, eq }) => and(eq(connections.connectionId, connectionId), eq(connections.name, name)),
    })) as BaseConnection;
  }

  async getConnectionById({ kId }: { kId: string }): Promise<BaseConnection | undefined> {
    return await this.db.query.connections.findFirst({
      where: (connections, { eq }) => eq(connections.id, kId),
    });
  }

  async getAllConnections(): Promise<Pick<BaseConnection, 'name' | 'connectionId'>[]> {
    return await this.db.query.connections.findMany({
      columns: {
        name: true,
        connectionId: true,
      },
    });
  }

  async getConnectionsByIntegrationName({ name }: { name: string }): Promise<BaseConnection[]> {
    return await this.db.query.connections.findMany({
      where: (connections, { eq }) => eq(connections.name, name),
      orderBy: (connections, { desc }) => [desc(connections.createdAt)],
    });
  }

  async getConnectionsBySubscriptionId({ subscriptionId }: { subscriptionId: string }): Promise<BaseConnection[]> {
    return await this.db.query.connections.findMany({
      where: (connections, { eq }) => eq(connections.subscriptionId, subscriptionId),
    });
  }

  async setConnectionSubscriptionId({
    kId,
    subscriptionId,
  }: {
    kId: string;
    subscriptionId: string;
  }): Promise<BaseConnection> {
    const updated = await this.db
      .update(schema.connections)
      .set({
        subscriptionId,
        updatedAt: new Date(), // Optional: update the timestamp
      })
      .where(eq(schema.connections.id, kId))
      .returning();

    if (!updated[0]) {
      throw new Error(`No connection found with id: ${kId}`);
    }

    return updated[0];
  }

  async createConnection({
    connection,
    credential,
  }: {
    connection: Omit<BaseConnection, 'createdAt' | 'updatedAt' | 'id' | 'lastSyncAt'>;
    credential: CredentialInput;
  }) {
    // Start a transaction since we're dealing with multiple tables
    return await this.db.transaction(async tx => {
      // Try to find existing connection
      const existingConnection = await tx
        .select()
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.connectionId, connection.connectionId),
            eq(schema.connections.name, connection.name),
          ),
        )
        .limit(1);

      console.log(existingConnection);

      let result;

      if (existingConnection.length === 0) {
        // Create new connection and credential
        result = await tx
          .insert(schema.connections)
          .values({
            ...connection,
          })
          .returning();

        await tx.insert(schema.credentials).values({
          ...credential,
          kId: result[0].id, // Assuming k_id is the foreign key
        });
      } else {
        result = await tx
          .update(schema.connections)
          .set({
            ...connection,
          })
          .where(
            and(
              eq(schema.connections.connectionId, connection.connectionId),
              eq(schema.connections.name, connection.name),
            ),
          )
          .returning();

        await tx.update(schema.credentials).set(credential).where(eq(schema.credentials.kId, result[0].id));
      }

      // Fetch the final result with credential
      const finalResult = await tx
        .select({
          connection: schema.connections,
          credential: schema.credentials,
        })
        .from(schema.connections)
        .leftJoin(schema.credentials, eq(schema.connections.id, schema.credentials.kId))
        .where(eq(schema.connections.id, result[0].id))
        .limit(1);

      // Transform the result to match expected return type
      return {
        ...finalResult[0].connection,
        credential: finalResult[0].credential,
      } as BaseConnection & { credential: BaseCredential };
    });
  }

  async setConnectionError({ kId, error }: { kId: string; error: string }): Promise<BaseConnection> {
    const updated = await this.db
      .update(schema.connections)
      .set({
        issues: [error],
        updatedAt: new Date(), // Optional: update the timestamp
      })
      .where(eq(schema.connections.id, kId))
      .returning();

    if (!updated[0]) {
      throw new Error(`No connection found with id: ${kId}`);
    }

    return updated[0];
  }

  async deleteConnection({ kId }: { kId: string }) {
    const deleted = await this.db.delete(schema.connections).where(eq(schema.connections.id, kId)).returning();

    // Return the first (and should be only) deleted record or null
    return (deleted[0] || null) as BaseConnection | null;
  }

  async getCredentialsByConnection(kId: string): Promise<CredentialWithConnection> {
    const result = await this.db.query.credentials.findFirst({
      where: (credentials, { eq }) => eq(credentials.kId, kId),
      with: {
        connection: true,
      },
    });

    if (!result) {
      throw new Error(`No credential found for connection id: ${kId}`);
    }

    return {
      id: result.id,
      type: result.type,
      value: result.value,
      scope: result.scope,
      kId: result.kId,
      connection: result.connection as BaseConnection,
    };
  }

  async updateConnectionCredentialToken({
    kId,
    token,
  }: {
    kId: string;
    token: Record<string, any>; // or your specific CredentialValue type
  }): Promise<BaseCredential> {
    const updated = await this.db
      .update(schema.credentials)
      .set({
        value: token,
        // If you need to update updatedAt or other fields, add them here
      })
      .where(eq(schema.credentials.kId, kId))
      .returning();

    if (!updated[0]) {
      throw new Error(`No credential found for connection id: ${kId}`);
    }

    return updated[0];
  }

  async updateConnectionCredentials({
    kId,
    ...update
  }: CredentialUpdateInput & { kId: string }): Promise<BaseCredential> {
    const updated = await this.db
      .update(schema.credentials)
      .set({
        ...update,
      })
      .where(eq(schema.credentials.kId, kId))
      .returning();

    if (!updated[0]) {
      throw new Error(`No credential found with kId: ${kId}`);
    }

    return updated[0];
  }

  async createEntity({
    connectionId,
    type,
    kId,
  }: {
    kId: string;
    type: string;
    connectionId: string;
  }): Promise<BaseEntity> {
    const created = await this.db
      .insert(schema.entities)
      .values({
        kId,
        type,
        createdBy: connectionId,
      })
      .returning();

    if (!created[0]) {
      throw new Error('Failed to create entity');
    }

    return created[0];
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

  async getEntityByConnectionAndType({ kId, type }: { kId: string; type: string }) {
    return (await this.db.query.entities.findFirst({
      where: (entities, { and, eq }) => and(eq(entities.kId, kId), eq(entities.type, type)),
    })) as BaseEntity | null;
  }

  async getEntityRecordsByConnectionAndType({ kId, type }: { kId: string; type: string }) {
    const result = await this.db.query.entities.findFirst({
      where: (entities, { and, eq }) => and(eq(entities.kId, kId), eq(entities.type, type)),
      with: {
        properties: true,
        records: true,
      },
    });

    return result as (BaseEntity & { properties: BaseProperty[]; records: BaseRecord[] }) | null;
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

  async deleteEntityById({ id }: { id: string }): Promise<BaseEntity> {
    const deleted = await this.db.delete(schema.entities).where(eq(schema.entities.id, id)).returning();

    if (!deleted[0]) {
      throw new Error(`No entity found with id: ${id}`);
    }

    return deleted[0];
  }

  async mergeExternalRecordsForEntity({
    entityId,
    records,
  }: {
    entityId: string;
    records: Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>[];
  }) {
    if (!records?.length) return;

    // Deduplicate records by externalId
    const uniqueRecordsMap = new Map<string, Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>>();
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
      .where(sql`${schema.records.entityId} = ${entityId} AND ${schema.records.externalId} IN ${externalIds}`);

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
          entityType: record.entityType,
          data: record.data,
        });
      }
    });

    const operations: Promise<any>[] = [];

    // Handle creations
    if (toCreate.length) {
      operations.push(this.db.insert(schema.records).values(toCreate));
    }

    if (toUpdate.length) {
      // Create a raw SQL query for bulk updates
      const updateQuery = sql`
              WITH updated_records ("externalId", "data") AS (
                VALUES
                ${sql.join(
                  toUpdate.map(({ externalId, data }) => {
                    return sql`(${externalId}, ${JSON.stringify(data)}::jsonb)`;
                  }),
                  sql`, `,
                )}
              )
              UPDATE ${records}
              SET "data" = updated_records."data"
              FROM updated_records
              WHERE ${schema.records.externalId} = updated_records."externalId"
            `;

      operations.push(this.db.execute(updateQuery));
    }

    await Promise.all(operations);
  }

  async addPropertiesToEntity({
    entityId,
    properties: propertiesToAdd,
  }: {
    entityId: string;
    properties: BaseProperty[];
  }): Promise<BaseEntity> {
    return await this.db.transaction(async tx => {
      // First, verify the entity exists
      const entity = await tx.select().from(schema.entities).where(eq(schema.entities.id, entityId)).limit(1);

      if (!entity[0]) {
        throw new Error(`No entity found with id: ${entityId}`);
      }

      // Insert all properties
      await tx.insert(schema.properties).values(
        propertiesToAdd.map(
          prop =>
            ({
              ...prop,
              entityId,
            }) as unknown as schema.NewProperty,
        ),
      );

      // Return the updated entity with its properties
      const result = await tx
        .select({
          entity: schema.entities,
          properties: schema.properties,
        })
        .from(schema.entities)
        .leftJoin(schema.properties, eq(schema.entities.id, schema.properties.entityId))
        .where(eq(schema.entities.id, entityId));

      // Transform the result to match your expected format
      const transformedResult = {
        ...entity[0],
        properties: result.map(r => r.properties).filter(Boolean),
      };

      return transformedResult;
    });
  }

  async getRecordsByPropertyName({ propertyName, connectionId }: { propertyName: string; connectionId: string }) {
    // Using sql template for JSON path operations
    const jsonPathCheck = sql`${schema.records.data}->>${sql.raw(`'${propertyName}'`)} IS NOT NULL`;

    return (await this.db
      .select({
        record: schema.records,
      })
      .from(schema.records)
      .innerJoin(schema.entities, eq(schema.records.entityId, schema.entities.id))
      .innerJoin(schema.connections, eq(schema.entities.kId, schema.connections.id))
      .where(and(eq(schema.connections.connectionId, connectionId), jsonPathCheck))) as { record: BaseRecord }[];
  }

  async getRecordByPropertyNameAndValue({
    propertyName,
    propertyValue,
    type,
    connectionId,
  }: {
    propertyName: string;
    propertyValue: string;
    type: string;
    connectionId: string;
  }) {
    // Using JSON path operator to check both existence and value
    const jsonPathValueCheck = sql`${schema.records.data}->>${sql.raw(`'${propertyName}'`)} = ${propertyValue}`;

    const result = await this.db
      .select({
        record: schema.records,
      })
      .from(schema.records)
      .innerJoin(schema.entities, eq(schema.records.entityId, schema.entities.id))
      .innerJoin(schema.connections, eq(schema.entities.kId, schema.connections.id))
      .where(and(eq(schema.connections.connectionId, connectionId), eq(schema.entities.type, type), jsonPathValueCheck))
      .limit(1);

    return (result[0]?.record || null) as BaseRecord | null;
  }

  async getRecordByPropertyNameAndValues({
    propertyName,
    propertyValues,
    type,
    connectionId,
  }: {
    propertyName: string;
    propertyValues: string[];
    type?: string;
    connectionId: string;
  }) {
    // Create the OR conditions for property values
    const jsonValueChecks = propertyValues.map(
      value => sql`${schema.records.data}->>${sql.raw(`'${propertyName}'`)} = ${value}`,
    );

    const whereConditions = [
      eq(schema.connections.connectionId, connectionId),
      // Only add type condition if it's provided
      ...(type ? [eq(schema.entities.type, type)] : []),
      // Add the OR condition for property values
      or(...jsonValueChecks),
    ];

    return (await this.db
      .select({
        record: schema.records,
      })
      .from(schema.records)
      .innerJoin(schema.entities, eq(schema.records.entityId, schema.entities.id))
      .innerJoin(schema.connections, eq(schema.entities.kId, schema.connections.id))
      .where(and(...whereConditions))) as { record: BaseRecord }[];
  }

  async deletePropertiesByEntityId({ id }: { id: string }): Promise<BaseProperty[]> {
    const deleted = await this.db.delete(schema.properties).where(eq(schema.properties.entityId, id)).returning();

    if (!deleted[0]) {
      throw new Error(`No records found with id: ${id}`);
    }
    return deleted as unknown as BaseProperty[];
  }

  async deleteRecordsByEntityId({ id }: { id: string }): Promise<BaseRecord[]> {
    const deleted = await this.db.delete(schema.records).where(eq(schema.records.entityId, id)).returning();

    if (!deleted[0]) {
      throw new Error(`No records found with id: ${id}`);
    }
    return deleted as BaseRecord[];
  }

  async getPropertiesByEntityType({ entityType }: { entityType: string }) {
    const data = await this.db
      .select()
      .from(schema.properties)
      .innerJoin(schema.entities, eq(schema.properties.entityId, schema.entities.id))
      .where(eq(schema.entities.type, entityType));

    return data as unknown as BaseProperty[];
  }

  async syncData({
    connectionId,
    name,
    data,
    type,
    properties,
    lastSyncId,
  }: {
    name: string;
    properties: BaseProperty[];
    connectionId: string;
    data: any;
    type: string;
    lastSyncId?: string;
  }) {
    const dataInt = await this.getConnection({
      connectionId,
      name,
    });

    if (!dataInt) {
      throw new Error(`No connection found for ${name}`);
    }

    let existingEntity = await this.getEntityByConnectionAndType({
      kId: dataInt?.id!,
      type,
    });

    if (!existingEntity) {
      existingEntity = await this.createEntity({
        kId: dataInt?.id!,
        type,
        connectionId,
      });

      await this.addPropertiesToEntity({
        entityId: existingEntity?.id!,
        properties,
      });
    }

    await this.mergeExternalRecordsForEntity({
      entityId: existingEntity?.id!,
      records: data,
    });

    if (lastSyncId) {
      await this.updateEntityLastSyncId({
        id: existingEntity?.id!,
        syncId: lastSyncId,
      });
    }
  }

  buildRecordQuerySql({
    whereClause,
    filterClause,
    sortClauses,
    entityType,
  }: {
    whereClause: string;
    filterClause?: string;
    entityType: string;
    sortClauses: string[];
  }) {
    return `
          SELECT
        "mastra"."records".*,
        row_to_json("mastra"."entity".*) AS "entity"
        FROM "mastra"."records"
        LEFT JOIN "mastra"."entity" ON "mastra"."entity"."id" = "mastra"."records"."entityId"
        ${whereClause}
        ${entityType ? `AND "mastra"."entity"."type" = '${entityType}'` : ''}
        AND "records"."deletedAt" IS NULL
        ${filterClause ? `AND ${filterClause}` : ''}
        ORDER BY ${sortClauses.length > 0 ? sortClauses.join(', ') : ''}
        `;
  }

  async getFilteredRecords<T extends string | number | symbol>({
    entityType,
    kId,
    filters,
    sort,
  }: {
    entityType: string;
    filters?: FilterObject<T>;
    sort?: string[];
    kId: string;
  }) {
    const properties = await this.getPropertiesByEntityType({
      entityType,
    });

    const dateFields = [
      {
        name: `createdAt`,
        type: `DATE`,
      },
      {
        name: `updatedAt`,
        type: `DATE`,
      },
    ];

    const fullProperties = [...properties, ...dateFields] as BaseProperty[];

    let filterClause = '',
      sortClauses: string[] = [`"mastra"."records"."createdAt" DESC`];

    if (filters) {
      filterClause = getFilterClauseSQL({
        filters,
        fields: fullProperties,
        parentTableRef: 'records',
      });
    }

    if (sort) {
      sortClauses = getSortClauseSQL({
        sort,
        fields: fullProperties,
        parentTableRef: 'records',
      });
    }

    const sqlStatement = this.buildRecordQuerySql({
      whereClause: `WHERE "mastra"."entity"."kId" = '${kId}'`,
      filterClause,
      sortClauses,
      entityType,
    });

    try {
      const records = await this.db.execute(sqlStatement);

      return records;
    } catch (e) {
      throw e;
    }
  }

  async getRecords<T extends string | number | symbol>({
    entityType,
    kId,
    filters,
    sort,
  }: {
    entityType: string;
    kId: string;
    filters?: FilterObject<T>;
    sort?: string[];
  }) {
    const recordData = this.getFilteredRecords({
      entityType,
      kId,
      filters,
      sort,
    });

    return recordData;
  }
}
