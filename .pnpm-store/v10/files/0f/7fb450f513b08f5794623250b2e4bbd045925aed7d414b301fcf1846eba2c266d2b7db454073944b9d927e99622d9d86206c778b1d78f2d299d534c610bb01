import { RecordBatch } from "apache-arrow";
export * from "./rrf";
export interface Reranker {
    rerankHybrid(query: string, vecResults: RecordBatch, ftsResults: RecordBatch): Promise<RecordBatch>;
}
