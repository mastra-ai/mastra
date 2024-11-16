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
}