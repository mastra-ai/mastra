// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class LastSeenIdentity extends APIResource {
    /**
     * Get last seen identity for a single user.
     *
     * @example
     * ```ts
     * const identity =
     *   await client.zeroTrust.access.users.lastSeenIdentity.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(userId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/users/${userId}/last_seen_identity`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=last-seen-identity.mjs.map