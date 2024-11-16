import { Pinecone } from '@pinecone-database/pinecone';
import { MastraVector } from '@mastra/core';

export class PineconeVector extends MastraVector {
    private client: Pinecone;

    constructor(apiKey: string, environment: string) {
        super();

        const opts: { apiKey: string, controllerHostUrl?: string } = { apiKey }

        if (environment) {
            opts['controllerHostUrl'] = environment
        }

        this.client = new Pinecone(opts);
    }

    async upsert(
        indexName: string,
        vectors: number[][],
        metadata?: Record<string, any>[],
        ids?: string[]
    ): Promise<string[]> {
        const index = this.client.Index(indexName);

        // Generate IDs if not provided
        const vectorIds = ids || vectors.map(() => crypto.randomUUID());

        const records = vectors.map((vector, i) => ({
            id: vectorIds[i],
            values: vector,
            metadata: metadata?.[i] || {}
        }));

        // Pinecone has a limit of 100 vectors per upsert request
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await index.upsert(batch);
        }

        return vectorIds;
    }

    async createIndex(
        indexName: string,
        dimension: number,
        metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
    ): Promise<void> {
        await this.client.createIndex({
            name: indexName,
            dimension: dimension,
            metric: metric,
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-west-2'
                }
            }
        });
    }
}