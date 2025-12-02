"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceGetResponsesSinglePage = exports.References = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class References extends resource_1.APIResource {
    /**
     * Get the list of resources that reference the provided monitor.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const referenceGetResponse of client.loadBalancers.monitors.references.get(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(monitorId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/monitors/${monitorId}/references`, ReferenceGetResponsesSinglePage, options);
    }
}
exports.References = References;
class ReferenceGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;
References.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;
//# sourceMappingURL=references.js.map