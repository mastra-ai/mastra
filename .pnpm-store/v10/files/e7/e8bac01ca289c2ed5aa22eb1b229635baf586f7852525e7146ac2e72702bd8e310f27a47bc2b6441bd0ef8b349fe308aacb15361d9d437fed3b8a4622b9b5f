// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
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
    rerank(body, options) {
        return this._client.post('/models/rerank', { body, ...options });
    }
}
//# sourceMappingURL=models.mjs.map