"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityResource = void 0;
const resource_1 = require("../../../resource.js");
class PriorityResource extends resource_1.APIResource {
    /**
     * Create a New Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const priority =
     *   await client.cloudforceOne.requests.priority.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     labels: ['DoS', 'CVE'],
     *     priority: 1,
     *     requirement: 'DoS attacks carried out by CVEs',
     *     tlp: 'clear',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/requests/priority/new`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const item =
     *   await client.cloudforceOne.requests.priority.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       labels: ['DoS', 'CVE'],
     *       priority: 1,
     *       requirement: 'DoS attacks carried out by CVEs',
     *       tlp: 'clear',
     *     },
     *   );
     * ```
     */
    update(priorityId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const priority =
     *   await client.cloudforceOne.requests.priority.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(priorityId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`, options);
    }
    /**
     * Get a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const item =
     *   await client.cloudforceOne.requests.priority.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(priorityId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Priority Intelligence Requirement Quota
     *
     * @example
     * ```ts
     * const quota =
     *   await client.cloudforceOne.requests.priority.quota({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    quota(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/requests/priority/quota`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.PriorityResource = PriorityResource;
//# sourceMappingURL=priority.js.map