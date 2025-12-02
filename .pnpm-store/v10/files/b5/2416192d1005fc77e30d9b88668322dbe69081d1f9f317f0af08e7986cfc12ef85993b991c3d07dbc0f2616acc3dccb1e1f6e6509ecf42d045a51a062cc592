import { RecordBatch } from "apache-arrow";
import { RrfReranker as NativeRRFReranker } from "../native";
/**
 * Reranks the results using the Reciprocal Rank Fusion (RRF) algorithm.
 *
 * @hideconstructor
 */
export declare class RRFReranker {
    private inner;
    /** @ignore */
    constructor(inner: NativeRRFReranker);
    static create(k?: number): Promise<RRFReranker>;
    rerankHybrid(query: string, vecResults: RecordBatch, ftsResults: RecordBatch): Promise<RecordBatch>;
}
