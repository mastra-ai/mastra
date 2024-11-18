export interface QueryResult {
    id: string;
    score: number;
    metadata?: Record<string, any>;
}
export abstract class MastraVector {
    abstract upsert(
        indexName: string,
        vectors: number[][],
        metadata?: Record<string, any>[],
        ids?: string[]
    ): Promise<string[]>;

    abstract createIndex(
        indexName: string,
        dimension: number,
        metric?: 'cosine' | 'euclidean' | 'dotproduct'
    ): Promise<void>;

    abstract query(
        indexName: string,
        queryVector: number[],
        topK?: number,
        filter?: Record<string, any>
    ): Promise<QueryResult[]>;

    abstract listIndexes(): Promise<string[]>;
}