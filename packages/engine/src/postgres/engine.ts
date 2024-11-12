import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { BaseConnection, CredentialInput, MastraEngine } from "../adapter";
import * as schema from './db/schema';
import { and, eq } from "drizzle-orm";

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

    async deleteConnection({ id }: { id: string }) {
        const deleted = await this.db.delete(schema.connections)
            .where(eq(schema.connections.id, id))
            .returning();

        // Return the first (and should be only) deleted record or null
        return (deleted[0] || null) as BaseConnection | null;
    }
}