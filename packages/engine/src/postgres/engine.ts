import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { BaseConnection, BaseCredential, BaseEntity, CredentialInput, CredentialUpdateInput, CredentialWithConnection, MastraEngine } from "../adapter";
import * as schema from './db/schema';
import { and, desc, eq, or, sql } from "drizzle-orm";

export class PostgresEngine implements MastraEngine {
    private db: PostgresJsDatabase<typeof schema>;
    constructor({ url }: { url: string }) {
        console.log('PostgresEngine')
        this.db = drizzle({ connection: { url }, schema });
    }

    async createConnection({
        connection,
        credential,
    }: {
        connection: Omit<BaseConnection, 'createdAt' | 'updatedAt' | 'id' | 'lastSyncAt'>;
        credential: CredentialInput;
    }) {
        // Start a transaction since we're dealing with multiple tables
        return await this.db.transaction(async (tx) => {
            // Try to find existing connection
            const existingConnection = await tx
                .select()
                .from(schema.connections)
                .where(
                    and(
                        eq(schema.connections.connectionId, connection.connectionId),
                        eq(schema.connections.name, connection.name)
                    )
                )
                .limit(1);

            console.log(existingConnection)

            let result;

            if (existingConnection.length === 0) {
                // Create new connection and credential
                result = await tx
                    .insert(schema.connections)
                    .values({
                        ...connection,
                    })
                    .returning();

                await tx
                    .insert(schema.credentials)
                    .values({
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
                            eq(schema.connections.name, connection.name)
                        )
                    )
                    .returning();

                await tx
                    .update(schema.credentials)
                    .set(credential)
                    .where(eq(schema.credentials.kId, result[0].id));
            }


            // Fetch the final result with credential
            const finalResult = await tx
                .select({
                    connection: schema.connections,
                    credential: schema.credentials,
                })
                .from(schema.connections)
                .leftJoin(
                    schema.credentials,
                    eq(schema.connections.id, schema.credentials.kId)
                )
                .where(eq(schema.connections.id, result[0].id))
                .limit(1);

            // Transform the result to match expected return type
            return {
                ...finalResult[0].connection,
                credential: finalResult[0].credential,
            };
        });
    }

    async getConnection({ connectionId, name, }: { name: string; connectionId: string; }) {
        return await this.db.query.connections.findFirst({
            where: (connections, { and, eq }) => and(
                eq(connections.connectionId, connectionId),
                eq(connections.name, name)
            ),
        }) as BaseConnection;
    }

    async getConnectionById({ k_id }: { k_id: string }): Promise<BaseConnection | undefined> {
        return await this.db.query.connections.findFirst({
            where: (connections, { eq }) => eq(connections.id, k_id)
        });
    }

    async getConnectionsByIntegrationName({ name }: { name: string }): Promise<BaseConnection[]> {
        return await this.db.query.connections.findMany({
            where: (connections, { eq }) => eq(connections.name, name),
            orderBy: (connections, { desc }) => [desc(connections.createdAt)]
        })
    }

    async getAllConnections(): Promise<Pick<BaseConnection, 'name' | 'connectionId'>[]> {
        return await this.db.query.connections.findMany({
            columns: {
                name: true,
                connectionId: true
            }
        });
    }

    async getCredentialsByConnection(k_id: string): Promise<CredentialWithConnection> {
        const result = await this.db.query.credentials.findFirst({
            where: (credentials, { eq }) => eq(credentials.kId, k_id),
            with: {
                connection: true
            }
        });

        if (!result) {
            throw new Error(`No credential found for connection id: ${k_id}`);
        }

        return {
            id: result.id,
            type: result.type,
            value: result.value,
            scope: result.scope,
            kId: result.kId,
            connection: result.connection as BaseConnection
        };
    }

    async updateConnectionCredential({
        k_id,
        token,
    }: {
        k_id: string;
        token: Record<string, any>;  // or your specific CredentialValue type
    }): Promise<BaseCredential> {
        const updated = await this.db
            .update(schema.credentials)
            .set({
                value: token,
                // If you need to update updatedAt or other fields, add them here
            })
            .where(eq(schema.credentials.kId, k_id))
            .returning();

        if (!updated[0]) {
            throw new Error(`No credential found for connection id: ${k_id}`);
        }

        return updated[0];
    }

    async updateConnectionCredentials({
        k_id,
        ...update
    }: CredentialUpdateInput & { k_id: string }): Promise<BaseCredential> {
        const updated = await this.db
            .update(schema.credentials)
            .set({
                ...update,
            })
            .where(eq(schema.credentials.kId, k_id))
            .returning();

        if (!updated[0]) {
            throw new Error(`No credential found with kId: ${k_id}`);
        }

        return updated[0];
    }

    async deleteConnection({ id }: { id: string }) {
        const deleted = await this.db.delete(schema.connections)
            .where(eq(schema.connections.id, id))
            .returning();

        // Return the first (and should be only) deleted record or null
        return (deleted[0] || null) as BaseConnection | null;
    }


    async createEntity({
        connectionId,
        type,
        k_id,
    }: {
        k_id: string;
        type: string;
        connectionId: string;
    }): Promise<BaseEntity> {
        const created = await this.db
            .insert(schema.entities)
            .values({
                kId: k_id,
                type,
                createdBy: connectionId,
                // createdAt will be set by default
            })
            .returning();

        if (!created[0]) {
            throw new Error('Failed to create entity');
        }

        return created[0];
    }

    async getEntityById(entityId: string): Promise<BaseEntity> {
        const result = await this.db.query.entities.findFirst({
            where: (entities, { eq }) => eq(entities.id, entityId)
        });

        if (!result) {
            throw new Error(`No entity found with id: ${entityId}`);
        }

        return result;
    }

    async updateEntityLastSyncId({
        entityId,
        syncId,
    }: {
        entityId: string;
        syncId: string;
    }): Promise<BaseEntity> {
        const updated = await this.db
            .update(schema.entities)
            .set({
                lastSyncId: syncId
            })
            .where(eq(schema.entities.id, entityId))
            .returning();

        if (!updated[0]) {
            throw new Error(`No entity found with id: ${entityId}`);
        }

        return updated[0];
    }

    async deleteEntityById(entityId: string): Promise<BaseEntity> {
        const deleted = await this.db
            .delete(schema.entities)
            .where(eq(schema.entities.id, entityId))
            .returning();

        if (!deleted[0]) {
            throw new Error(`No entity found with id: ${entityId}`);
        }

        return deleted[0];
    }


    async addPropertiesToEntity({
        entityId,
        properties: propertiesToAdd,
    }: {
        entityId: string;
        properties: schema.NewProperty[];
    }): Promise<BaseEntity> {
        return await this.db.transaction(async (tx) => {
            // First, verify the entity exists
            const entity = await tx
                .select()
                .from(schema.entities)
                .where(eq(schema.entities.id, entityId))
                .limit(1);

            if (!entity[0]) {
                throw new Error(`No entity found with id: ${entityId}`);
            }

            // Insert all properties
            await tx
                .insert(schema.properties)
                .values(
                    propertiesToAdd.map(prop => ({
                        ...prop,
                        entityId
                    }))
                );

            // Return the updated entity with its properties
            const result = await tx
                .select({
                    entity: schema.entities,
                    properties: schema.properties
                })
                .from(schema.entities)
                .leftJoin(
                    schema.properties,
                    eq(schema.entities.id, schema.properties.entityId)
                )
                .where(eq(schema.entities.id, entityId));

            // Transform the result to match your expected format
            const transformedResult = {
                ...entity[0],
                properties: result.map(r => r.properties).filter(Boolean)
            };

            return transformedResult;
        });
    }

    async getEntityRecordsByConnectionAndType({
        k_id,
        type,
    }: {
        k_id: string;
        type: string;
    }) {
        const result = await this.db.query.entities.findFirst({
            where: (entities, { and, eq }) => and(
                eq(entities.kId, k_id),
                eq(entities.type, type)
            ),
            with: {
                properties: true,
                records: true
            }
        });

        return result;
    }

    async getEntityByConnectionAndType({
        k_id,
        type,
    }: {
        k_id: string;
        type: string;
    }) {
        return await this.db.query.entities.findFirst({
            where: (entities, { and, eq }) => and(
                eq(entities.kId, k_id),
                eq(entities.type, type)
            )
        });
    }

    async setConnectionError({
        k_id,
        error
    }: {
        k_id: string;
        error: string
    }): Promise<BaseConnection> {
        const updated = await this.db
            .update(schema.connections)
            .set({
                issues: [error],
                updatedAt: new Date()  // Optional: update the timestamp
            })
            .where(eq(schema.connections.id, k_id))
            .returning();

        if (!updated[0]) {
            throw new Error(`No connection found with id: ${k_id}`);
        }

        return updated[0];
    }

    async setConnectionSubscriptionId({
        k_id,
        subscriptionId,
    }: {
        k_id: string;
        subscriptionId: string;
    }): Promise<BaseConnection> {
        const updated = await this.db
            .update(schema.connections)
            .set({
                subscriptionId,
                updatedAt: new Date()  // Optional: update the timestamp
            })
            .where(eq(schema.connections.id, k_id))
            .returning();

        if (!updated[0]) {
            throw new Error(`No connection found with id: ${k_id}`);
        }

        return updated[0];
    }

    async getConnectionsBySubscriptionId({
        subscriptionId,
    }: {
        subscriptionId: string;
    }): Promise<BaseConnection[]> {
        return await this.db.query.connections.findMany({
            where: (connections, { eq }) => eq(connections.subscriptionId, subscriptionId)
        });
    }

    async getRecordsByPropertyName({
        propertyName,
        connectionId,
    }: {
        propertyName: string;
        connectionId: string;
    }) {
        // Using sql template for JSON path operations
        const jsonPathCheck = sql`${schema.records.data}->>${sql.raw(`'${propertyName}'`)} IS NOT NULL`;

        return await this.db
            .select({
                record: schema.records
            })
            .from(schema.records)
            .innerJoin(
                schema.entities,
                eq(schema.records.entityId, schema.entities.id)
            )
            .innerJoin(
                schema.connections,
                eq(schema.entities.kId, schema.connections.id)
            )
            .where(
                and(
                    eq(schema.connections.connectionId, connectionId),
                    jsonPathCheck
                )
            );
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
                record: schema.records
            })
            .from(schema.records)
            .innerJoin(
                schema.entities,
                eq(schema.records.entityId, schema.entities.id)
            )
            .innerJoin(
                schema.connections,
                eq(schema.entities.kId, schema.connections.id)
            )
            .where(
                and(
                    eq(schema.connections.connectionId, connectionId),
                    eq(schema.entities.type, type),
                    jsonPathValueCheck
                )
            )
            .limit(1);

        return result[0]?.record || null;
    }

    async getRecordByPropertyNameAndValues({
        propertyName,
        propertValues,
        type,
        connectionId,
    }: {
        propertyName: string;
        propertValues: string[];
        type?: string;
        connectionId: string;
    }) {
        // Create the OR conditions for property values
        const jsonValueChecks = propertValues.map(value =>
            sql`${schema.records.data}->>${sql.raw(`'${propertyName}'`)} = ${value}`
        );

        const whereConditions = [
            eq(schema.connections.connectionId, connectionId),
            // Only add type condition if it's provided
            ...(type ? [eq(schema.entities.type, type)] : []),
            // Add the OR condition for property values
            or(...jsonValueChecks)
        ];

        return await this.db
            .select({
                record: schema.records
            })
            .from(schema.records)
            .innerJoin(
                schema.entities,
                eq(schema.records.entityId, schema.entities.id)
            )
            .innerJoin(
                schema.connections,
                eq(schema.entities.kId, schema.connections.id)
            )
            .where(and(...whereConditions));
    }
}