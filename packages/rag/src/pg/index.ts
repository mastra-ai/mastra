import { MastraVector } from '@mastra/core';
import { Pool } from 'pg';

export class PgVector extends MastraVector {
    private pool: Pool;

    constructor(connectionString: string) {
        super();
        this.pool = new Pool({ connectionString });
    }

    async upsert(
        indexName: string,
        vectors: number[][],
        metadata?: Record<string, any>[],
        ids?: string[]
    ): Promise<string[]> {
        const vectorIds = ids || vectors.map(() => crypto.randomUUID());

        // Start a transaction
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Build the query with parameter placeholders
            const values = vectors.map((vector, i) => [
                vectorIds[i],
                vector,
                metadata?.[i] ? JSON.stringify(metadata[i]) : '{}'
            ]).flat();

            // Create placeholders for prepared statement
            const placeholders = vectors.map((_, i) => {
                const offset = i * 3;
                return `($${offset + 1}, $${offset + 2}::vector, $${offset + 3}::jsonb)`;
            }).join(', ');

            const query = `
                INSERT INTO ${indexName} (vector_id, embedding, metadata)
                VALUES ${placeholders}
                ON CONFLICT (vector_id) 
                DO UPDATE SET 
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata
            `;

            await client.query(query, values);
            await client.query('COMMIT');

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
}