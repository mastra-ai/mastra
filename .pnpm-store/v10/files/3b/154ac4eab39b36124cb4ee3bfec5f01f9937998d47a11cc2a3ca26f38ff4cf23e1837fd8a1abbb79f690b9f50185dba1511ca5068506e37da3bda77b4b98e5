"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessUsersSinglePage = exports.Users = void 0;
const resource_1 = require("../../../../resource.js");
const users_1 = require("../../access/users/users.js");
Object.defineProperty(exports, "AccessUsersSinglePage", { enumerable: true, get: function () { return users_1.AccessUsersSinglePage; } });
class Users extends resource_1.APIResource {
    /**
     * Lists SCIM User resources synced to Cloudflare via the System for Cross-domain
     * Identity Management (SCIM).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const accessUser of client.zeroTrust.identityProviders.scim.users.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(identityProviderId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/identity_providers/${identityProviderId}/scim/users`, users_1.AccessUsersSinglePage, { query, ...options });
    }
}
exports.Users = Users;
//# sourceMappingURL=users.js.map