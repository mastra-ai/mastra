// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Policies extends APIResource {
    /**
     * Creates a new Notification policy.
     *
     * @example
     * ```ts
     * const policy = await client.alerting.policies.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   alert_type: 'universal_ssl_event_type',
     *   enabled: true,
     *   mechanisms: {},
     *   name: 'SSL Notification Event Policy',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/alerting/v3/policies`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Notification policy.
     *
     * @example
     * ```ts
     * const policy = await client.alerting.policies.update(
     *   '0da2b59e-f118-439d-8097-bdfb215203c9',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(policyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/alerting/v3/policies/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a list of all Notification policies.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const policy of client.alerting.policies.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/alerting/v3/policies`, PoliciesSinglePage, options);
    }
    /**
     * Delete a Notification policy.
     *
     * @example
     * ```ts
     * const policy = await client.alerting.policies.delete(
     *   '0da2b59e-f118-439d-8097-bdfb215203c9',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(policyId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/alerting/v3/policies/${policyId}`, options);
    }
    /**
     * Get details for a single policy.
     *
     * @example
     * ```ts
     * const policy = await client.alerting.policies.get(
     *   '0da2b59e-f118-439d-8097-bdfb215203c9',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/alerting/v3/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class PoliciesSinglePage extends SinglePage {
}
Policies.PoliciesSinglePage = PoliciesSinglePage;
//# sourceMappingURL=policies.mjs.map