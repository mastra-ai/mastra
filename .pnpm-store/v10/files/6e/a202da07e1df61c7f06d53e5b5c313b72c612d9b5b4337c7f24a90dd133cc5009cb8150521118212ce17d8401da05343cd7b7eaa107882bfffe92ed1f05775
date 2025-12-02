"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersV4PagePaginationArray = exports.Members = void 0;
const resource_1 = require("../../resource.js");
const shared_1 = require("../shared.js");
Object.defineProperty(exports, "MembersV4PagePaginationArray", { enumerable: true, get: function () { return shared_1.MembersV4PagePaginationArray; } });
class Members extends resource_1.APIResource {
    /**
     * Add a user to the list of members for this account.
     *
     * @example
     * ```ts
     * const member = await client.accounts.members.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   email: 'user@example.com',
     *   roles: ['3536bcfad5faccb999b47003c79917fb'],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/members`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify an account member.
     *
     * @example
     * ```ts
     * const member = await client.accounts.members.update(
     *   '4536bcfad5faccb111b47003c79917fa',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(memberId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/members/${memberId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all members of an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const member of client.accounts.members.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/members`, shared_1.MembersV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Remove a member from an account.
     *
     * @example
     * ```ts
     * const member = await client.accounts.members.delete(
     *   '4536bcfad5faccb111b47003c79917fa',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(memberId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/members/${memberId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information about a specific member of an account.
     *
     * @example
     * ```ts
     * const member = await client.accounts.members.get(
     *   '4536bcfad5faccb111b47003c79917fa',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(memberId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/members/${memberId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Members = Members;
//# sourceMappingURL=members.js.map