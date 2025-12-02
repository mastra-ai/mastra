// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class Models extends APIResource {
  /**
   * Reranks the provided documents, according to the provided query.
   *
   * The results will be sorted by descending order of relevance. For each document,
   * the index and the score will be returned. The index is relative to the documents
   * array that was passed in. The score is the query-document relevancy determined
   * by the reranker model. The value will be returned in descending order to
   * relevance.
   */
  rerank(body: ModelRerankParams, options?: Core.RequestOptions): Core.APIPromise<ModelRerankResponse> {
    return this._client.post('/models/rerank', { body, ...options });
  }
}

export interface ModelRerankResponse {
  /**
   * The results, ordered by descending order of relevance to the query.
   */
  results: Array<ModelRerankResponse.Result>;
}

export namespace ModelRerankResponse {
  export interface Result {
    /**
     * The index of this document, relative to the original document array passed into
     * the request.
     */
    index: number;

    /**
     * The relevance score between this document and the query. This number will range
     * between 0.0 and 1.0. This score is dependent on only the query and the scored
     * document; other documents do not affect this score. This value is deterministic,
     * but may vary slightly due to floating point error.
     */
    relevance_score: number;
  }
}

export interface ModelRerankParams {
  /**
   * The list of documents to rerank. Each document is a string.
   */
  documents: Array<string>;

  /**
   * The query to rerank the documents by. Results will be in descending order of
   * relevance.
   */
  query: string;

  /**
   * The model ID to use for reranking. Options are: ["zerank-1-large"]
   */
  model?: string;

  /**
   * If provided, then only the top `n` documents will be returned in the results
   * array.
   */
  top_n?: number | null;
}

export declare namespace Models {
  export { type ModelRerankResponse as ModelRerankResponse, type ModelRerankParams as ModelRerankParams };
}
