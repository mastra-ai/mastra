"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateListResponsesSinglePage = exports.Updates = void 0;
const resource_1 = require("../../../../../resource.js");
const pagination_1 = require("../../../../../pagination.js");
class Updates extends resource_1.APIResource {
    /**
     * Lists Access SCIM update logs that maintain a record of updates made to User and
     * Group resources synced to Cloudflare via the System for Cross-domain Identity
     * Management (SCIM).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const updateListResponse of client.zeroTrust.access.logs.scim.updates.list(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     idp_id: [
     *       'df7e2w5f-02b7-4d9d-af26-8d1988fca630',
     *       '0194ae2c-efcf-7cfb-8884-055f1a161fa5',
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/logs/scim/updates`, UpdateListResponsesSinglePage, { query, ...options });
    }
}
exports.Updates = Updates;
class UpdateListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.UpdateListResponsesSinglePage = UpdateListResponsesSinglePage;
Updates.UpdateListResponsesSinglePage = UpdateListResponsesSinglePage;
//# sourceMappingURL=updates.js.map