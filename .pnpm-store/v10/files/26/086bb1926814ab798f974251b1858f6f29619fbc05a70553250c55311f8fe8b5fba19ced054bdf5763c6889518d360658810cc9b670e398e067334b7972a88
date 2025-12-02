"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessRequests = void 0;
const resource_1 = require("../../../../resource.js");
class AccessRequests extends resource_1.APIResource {
    /**
     * Gets a list of Access authentication audit logs for an account.
     *
     * @example
     * ```ts
     * const accessRequests =
     *   await client.zeroTrust.access.logs.accessRequests.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/access/logs/access_requests`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.AccessRequests = AccessRequests;
//# sourceMappingURL=access-requests.js.map