// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Search extends APIResource {
    /**
     * Searches for locations, autonomous systems, reports, and bots.
     *
     * @example
     * ```ts
     * const response = await client.radar.search.global({
     *   query: 'United',
     * });
     * ```
     */
    global(query, options) {
        return this._client.get('/radar/search/global', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=search.mjs.map