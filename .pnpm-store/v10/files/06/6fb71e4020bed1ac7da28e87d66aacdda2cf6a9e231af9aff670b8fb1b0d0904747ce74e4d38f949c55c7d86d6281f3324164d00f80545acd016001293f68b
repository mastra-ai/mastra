"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelegationsSinglePage = exports.Delegations = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Delegations extends resource_1.APIResource {
    /**
     * Create a new account delegation for a given IP prefix.
     *
     * @example
     * ```ts
     * const delegations =
     *   await client.addressing.prefixes.delegations.create(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     {
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *       cidr: '192.0.2.0/24',
     *       delegated_account_id:
     *         'b1946ac92492d2347c6235b4d2611184',
     *     },
     *   );
     * ```
     */
    create(prefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all delegations for a given account IP prefix.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const delegations of client.addressing.prefixes.delegations.list(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(prefixId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations`, DelegationsSinglePage, options);
    }
    /**
     * Delete an account delegation for a given IP prefix.
     *
     * @example
     * ```ts
     * const delegation =
     *   await client.addressing.prefixes.delegations.delete(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     'd933b1530bc56c9953cf8ce166da8004',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    delete(prefixId, delegationId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/prefixes/${prefixId}/delegations/${delegationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Delegations = Delegations;
class DelegationsSinglePage extends pagination_1.SinglePage {
}
exports.DelegationsSinglePage = DelegationsSinglePage;
Delegations.DelegationsSinglePage = DelegationsSinglePage;
//# sourceMappingURL=delegations.js.map