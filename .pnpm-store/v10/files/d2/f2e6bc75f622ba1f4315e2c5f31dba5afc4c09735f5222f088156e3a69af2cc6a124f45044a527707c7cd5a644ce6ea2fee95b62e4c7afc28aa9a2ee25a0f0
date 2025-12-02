"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipsV4PagePaginationArray = exports.Memberships = void 0;
const resource_1 = require("../resource.js");
const core_1 = require("../core.js");
const pagination_1 = require("../pagination.js");
class Memberships extends resource_1.APIResource {
    /**
     * Accept or reject this account invitation.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.update(
     *   '4536bcfad5faccb111b47003c79917fa',
     *   { status: 'accepted' },
     * );
     * ```
     */
    update(membershipId, body, options) {
        return this._client.put(`/memberships/${membershipId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/memberships', MembershipsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Remove the associated member from an account.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.delete(
     *   '4536bcfad5faccb111b47003c79917fa',
     * );
     * ```
     */
    delete(membershipId, options) {
        return this._client.delete(`/memberships/${membershipId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific membership.
     *
     * @example
     * ```ts
     * const membership = await client.memberships.get(
     *   '4536bcfad5faccb111b47003c79917fa',
     * );
     * ```
     */
    get(membershipId, options) {
        return this._client.get(`/memberships/${membershipId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Memberships = Memberships;
class MembershipsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.MembershipsV4PagePaginationArray = MembershipsV4PagePaginationArray;
Memberships.MembershipsV4PagePaginationArray = MembershipsV4PagePaginationArray;
//# sourceMappingURL=memberships.js.map