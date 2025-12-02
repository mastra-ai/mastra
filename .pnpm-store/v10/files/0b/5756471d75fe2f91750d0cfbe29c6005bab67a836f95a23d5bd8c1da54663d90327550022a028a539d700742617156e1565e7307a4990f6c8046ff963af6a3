"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroTrustGroupsSinglePage = exports.Groups = void 0;
const resource_1 = require("../../../../resource.js");
const groups_1 = require("../../access/groups.js");
Object.defineProperty(exports, "ZeroTrustGroupsSinglePage", { enumerable: true, get: function () { return groups_1.ZeroTrustGroupsSinglePage; } });
class Groups extends resource_1.APIResource {
    /**
     * Lists SCIM Group resources synced to Cloudflare via the System for Cross-domain
     * Identity Management (SCIM).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const zeroTrustGroup of client.zeroTrust.identityProviders.scim.groups.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(identityProviderId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/identity_providers/${identityProviderId}/scim/groups`, groups_1.ZeroTrustGroupsSinglePage, { query, ...options });
    }
}
exports.Groups = Groups;
//# sourceMappingURL=groups.js.map