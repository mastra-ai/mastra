"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseBulkResponsesSinglePage = exports.Release = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Release extends resource_1.APIResource {
    /**
     * Release messages from quarantine
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const releaseBulkResponse of client.emailSecurity.investigate.release.bulk(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: ['4Njp3P0STMz2c02Q'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulk(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/investigate/release`, ReleaseBulkResponsesSinglePage, { body: body, method: 'post', ...options });
    }
}
exports.Release = Release;
class ReleaseBulkResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ReleaseBulkResponsesSinglePage = ReleaseBulkResponsesSinglePage;
Release.ReleaseBulkResponsesSinglePage = ReleaseBulkResponsesSinglePage;
//# sourceMappingURL=release.js.map