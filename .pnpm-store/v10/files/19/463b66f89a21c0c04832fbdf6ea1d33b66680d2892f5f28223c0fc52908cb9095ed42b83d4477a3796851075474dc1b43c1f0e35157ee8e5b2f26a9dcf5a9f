"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesV4PagePaginationArray = exports.Roles = void 0;
const resource_1 = require("../../resource.js");
const shared_1 = require("../shared.js");
Object.defineProperty(exports, "RolesV4PagePaginationArray", { enumerable: true, get: function () { return shared_1.RolesV4PagePaginationArray; } });
class Roles extends resource_1.APIResource {
    /**
     * Get all available roles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const role of client.accounts.roles.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/roles`, shared_1.RolesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Get information about a specific role for an account.
     *
     * @example
     * ```ts
     * const role = await client.accounts.roles.get(
     *   '3536bcfad5faccb999b47003c79917fb',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(roleId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/roles/${roleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Roles = Roles;
//# sourceMappingURL=roles.js.map