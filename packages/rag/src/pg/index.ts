import { MastraVector, QueryResult, IndexStats } from '@mastra/core';
import { Pool } from 'pg';

export class PgVector extends MastraVector {
    private pool: Pool;

    constructor(connectionString: string) {
        super();
        this.pool = new Pool({
            connectionString,
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
            connectionTimeoutMillis: 2000 // Fail fast if can't connect
        });
    }

    async query(
        indexName: string,
        queryVector: number[],
        topK: number = 10,
        filter?: Record<string, any>
    ): Promise<QueryResult[]> {
        const client = await this.pool.connect();
        try {
            let filterQuery = '';
            let filterValues: any[] = [topK];  // Start with just topK
            const vectorStr = `[${queryVector.join(',')}]`;  // Format vector string

            // Build filter query if filter is provided
            if (filter) {
                const conditions = Object.entries(filter).map(([key, value], index) => {
                    filterValues.push(value);
                    return `metadata->>'${key}' = $${index + 2}`; // Start from $2 now
                });
                if (conditions.length > 0) {
                    filterQuery = 'AND ' + conditions.join(' AND ');
                }
            }

            const query = `
                SELECT 
                    vector_id as id,
                    1 - (embedding <=> '${vectorStr}'::vector) as score,
                    metadata
                FROM ${indexName}
                WHERE true ${filterQuery}
                ORDER BY embedding <=> '${vectorStr}'::vector
                LIMIT $1;
            `;

            const result = await client.query(query, filterValues);

            return result.rows.map(row => ({
                id: row.id,
                score: row.score,
                metadata: row.metadata
            }));
        } finally {
            client.release();
        }
    }

    async upsert(
        indexName: string,
        vectors: number[][],
        metadata?: Record<string, any>[],
        ids?: string[]
    ): Promise<string[]> {
        // Start a transaction
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const vectorIds = ids || vectors.map(() => crypto.randomUUID());

            for (let i = 0; i < vectors.length; i++) {

                // First let's just try to select the current value to see what's there
                const checkQuery = `
            SELECT vector_id, embedding::text, metadata 
            FROM ${indexName} 
            WHERE vector_id = $1
        `;
                const current = await client.query(checkQuery, [vectorIds[i]]);
                console.log('Current value:', current.rows[0]);

                const query = `
            INSERT INTO ${indexName} (vector_id, embedding, metadata)
            VALUES ($1, $2::vector, $3::jsonb)
            ON CONFLICT (vector_id) 
            DO UPDATE SET 
                embedding = $2::vector,
                metadata = $3::jsonb
            RETURNING embedding::text
        `;

                const result = await client.query(query, [
                    vectorIds[i],
                    `[${vectors[i].join(',')}]`,
                    JSON.stringify(metadata?.[i] || {})
                ]);
                console.log('After update:', result.rows[0]);

            }
            return vectorIds;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createIndex(
        indexName: string,
        dimension: number,
        metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            // Create the extension if it doesn't exist
            await client.query('CREATE EXTENSION IF NOT EXISTS vector');

            // Create the table
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${indexName} (
                    id SERIAL PRIMARY KEY,
                    vector_id TEXT UNIQUE NOT NULL,
                    embedding vector(${dimension}),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            `);

            // Create an index for vector similarity search based on metric
            const indexMethod = metric === 'cosine' ? 'vector_cosine_ops' :
                metric === 'euclidean' ? 'vector_l2_ops' :
                    'vector_ip_ops'; // for dotproduct

            await client.query(`
                CREATE INDEX IF NOT EXISTS ${indexName}_vector_idx 
                ON ${indexName} 
                USING ivfflat (embedding ${indexMethod})
                WITH (lists = 100);
            `);
        } finally {
            client.release();
        }
    }

    async listIndexes(): Promise<string[]> {
        const client = await this.pool.connect();
        try {
            // Query to get all tables that have a vector column
            const query = `
            SELECT table_name 
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            AND EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = t.table_name
                AND data_type = 'USER-DEFINED'
                AND udt_name = 'vector'
            );
        `;

            const result = await client.query(query);
            return result.rows.map(row => row.table_name);
        } finally {
            client.release();
        }
    }

    async describeIndex(indexName: string): Promise<IndexStats> {
        const client = await this.pool.connect();
        try {
            // Get vector dimension
            const dimensionQuery = `
                SELECT atttypmod as dimension
                FROM pg_attribute
                WHERE attrelid = $1::regclass
                AND attname = 'embedding';
            `;

            // Get row count
            const countQuery = `
                SELECT COUNT(*) as count 
                FROM ${indexName};
            `;

            // Get index metric type
            const metricQuery = `
            SELECT 
                am.amname as index_method,
                opclass.opcname as operator_class
            FROM pg_index i
            JOIN pg_class c ON i.indexrelid = c.oid
            JOIN pg_am am ON c.relam = am.oid
            JOIN pg_opclass opclass ON i.indclass[0] = opclass.oid
            WHERE c.relname = '${indexName}_vector_idx';
            `;

            const [dimResult, countResult, metricResult] = await Promise.all([
                client.query(dimensionQuery, [indexName]),
                client.query(countQuery),
                client.query(metricQuery)
            ]);

            // Convert pg_vector index method to our metric type
            let metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine';
            if (metricResult.rows.length > 0) {
                const operatorClass = metricResult.rows[0].operator_class;
                if (operatorClass.includes('l2')) {
                    metric = 'euclidean';
                } else if (operatorClass.includes('ip')) {
                    metric = 'dotproduct';
                } else if (operatorClass.includes('cosine')) {
                    metric = 'cosine';
                }
            }

            return {
                dimension: dimResult.rows[0].dimension,
                count: parseInt(countResult.rows[0].count),
                metric
            };
        } finally {
            client.release();
        }
    }

    async deleteIndex(indexName: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            // Drop the index first
            await client.query(`DROP INDEX IF EXISTS ${indexName}_vector_idx`);
            // Drop the table
            await client.query(`DROP TABLE IF EXISTS ${indexName}`);
        } catch (error: any) {
            throw new Error(`Failed to delete vector table: ${error.message}`);
        } finally {
            client.release()
        }
    }

    async truncateIndex(indexName: string) {
        const client = await this.pool.connect();
        try {
            await client.query(`TRUNCATE ${indexName}`)
        } catch (e) {
            console.error(e);
        } finally {
            client.release();
        }

    }

    async disconnect() {
        await this.pool.end();
    }
}