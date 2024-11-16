export abstract class MastraVector {
    abstract upsert(
        indexName: string,
        vectors: number[][],
        metadata?: Record<string, any>[],
        ids?: string[]
    ): Promise<string[]>;
}