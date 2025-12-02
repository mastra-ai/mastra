// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Policies extends APIResource {
    /**
     * Creates a new Access reusable policy.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.policies.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     decision: 'allow',
     *     include: [
     *       {
     *         group: {
     *           id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
     *         },
     *       },
     *     ],
     *     name: 'Allow devs',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/access/policies`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a Access reusable policy.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.policies.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       decision: 'allow',
     *       include: [
     *         {
     *           group: {
     *             id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
     *           },
     *         },
     *       ],
     *       name: 'Allow devs',
     *     },
     *   );
     * ```
     */
    update(policyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/access/policies/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Access reusable policies.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const policyListResponse of client.zeroTrust.access.policies.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/policies`, PolicyListResponsesSinglePage, options);
    }
    /**
     * Deletes an Access reusable policy.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.policies.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(policyId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/access/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Access reusable policy.
     *
     * @example
     * ```ts
     * const policy = await client.zeroTrust.access.policies.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class PolicyListResponsesSinglePage extends SinglePage {
}
Policies.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
//# sourceMappingURL=policies.mjs.map