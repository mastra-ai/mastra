// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { isRequestOptions } from "../core.mjs";
import { V4PagePaginationArray } from "../pagination.mjs";
export class Memberships extends APIResource {
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
        if (isRequestOptions(query)) {
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
export class MembershipsV4PagePaginationArray extends V4PagePaginationArray {
}
Memberships.MembershipsV4PagePaginationArray = MembershipsV4PagePaginationArray;
//# sourceMappingURL=memberships.mjs.map