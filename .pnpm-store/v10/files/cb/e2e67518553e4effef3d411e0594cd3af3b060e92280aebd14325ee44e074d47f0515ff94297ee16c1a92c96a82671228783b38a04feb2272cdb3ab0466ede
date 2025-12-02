"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstantLogpushJobsSinglePage = exports.Edge = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Edge extends resource_1.APIResource {
    /**
     * Creates a new Instant Logs job for a zone.
     *
     * @example
     * ```ts
     * const instantLogpushJob = await client.logpush.edge.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/logpush/edge`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Instant Logs jobs for a zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const instantLogpushJob of client.logpush.edge.get(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/logpush/edge`, InstantLogpushJobsSinglePage, options);
    }
}
exports.Edge = Edge;
class InstantLogpushJobsSinglePage extends pagination_1.SinglePage {
}
exports.InstantLogpushJobsSinglePage = InstantLogpushJobsSinglePage;
Edge.InstantLogpushJobsSinglePage = InstantLogpushJobsSinglePage;
//# sourceMappingURL=edge.js.map