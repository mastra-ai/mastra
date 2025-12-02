// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
export class Queries extends APIResource {
    /**
     * Get the top K documents that match the given query
     */
    topDocuments(body, options) {
        return this._client.post('/queries/top-documents', { body, ...options });
    }
    /**
     * Get the top K pages that match the given query
     */
    topPages(body, options) {
        return this._client.post('/queries/top-pages', { body, ...options });
    }
    /**
     * Get the top K snippets that match the given query.
     *
     * You may choose between coarse and precise snippets. Precise snippets will
     * average ~200 characters, while coarse snippets will average ~2000 characters.
     * The default is coarse snippets. Use the `precise_responses` parameter to adjust.
     */
    topSnippets(body, options) {
        return this._client.post('/queries/top-snippets', { body, ...options });
    }
}
//# sourceMappingURL=queries.mjs.map