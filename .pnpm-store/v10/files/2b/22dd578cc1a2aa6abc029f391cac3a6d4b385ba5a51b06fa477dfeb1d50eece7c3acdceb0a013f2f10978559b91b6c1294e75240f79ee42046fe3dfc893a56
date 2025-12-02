// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Policies extends APIResource {
    /**
     * Create a Page Shield policy.
     *
     * @example
     * ```ts
     * const policy = await client.pageShield.policies.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   action: 'allow',
     *   description: 'Checkout page CSP policy',
     *   enabled: true,
     *   expression:
     *     'ends_with(http.request.uri.path, "/checkout")',
     *   value: "script-src 'none';",
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/page_shield/policies`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Page Shield policy by ID.
     *
     * @example
     * ```ts
     * const policy = await client.pageShield.policies.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(policyId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/page_shield/policies/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all Page Shield policies.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const policyListResponse of client.pageShield.policies.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/page_shield/policies`, PolicyListResponsesSinglePage, options);
    }
    /**
     * Delete a Page Shield policy by ID.
     *
     * @example
     * ```ts
     * await client.pageShield.policies.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(policyId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/page_shield/policies/${policyId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Fetches a Page Shield policy by ID.
     *
     * @example
     * ```ts
     * const policy = await client.pageShield.policies.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(policyId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/page_shield/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class PolicyListResponsesSinglePage extends SinglePage {
}
Policies.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
//# sourceMappingURL=policies.mjs.map