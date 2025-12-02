"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Search = void 0;
const resource_1 = require("../../resource.js");
class Search extends resource_1.APIResource {
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
exports.Search = Search;
//# sourceMappingURL=search.js.map