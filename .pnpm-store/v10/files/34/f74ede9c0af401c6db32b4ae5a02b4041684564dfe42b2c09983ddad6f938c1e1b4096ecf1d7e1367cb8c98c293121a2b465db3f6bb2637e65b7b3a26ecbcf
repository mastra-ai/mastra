// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { AccessUsersSinglePage } from "../../access/users/users.mjs";
export class Users extends APIResource {
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
        return this._client.getAPIList(`/accounts/${account_id}/access/identity_providers/${identityProviderId}/scim/users`, AccessUsersSinglePage, { query, ...options });
    }
}
export { AccessUsersSinglePage };
//# sourceMappingURL=users.mjs.map