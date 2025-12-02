// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class AccessRequests extends APIResource {
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
//# sourceMappingURL=access-requests.mjs.map