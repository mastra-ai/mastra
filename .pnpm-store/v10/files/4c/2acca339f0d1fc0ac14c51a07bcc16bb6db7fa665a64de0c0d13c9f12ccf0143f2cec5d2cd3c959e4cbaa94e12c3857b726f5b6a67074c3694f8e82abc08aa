"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CNIs = void 0;
const resource_1 = require("../../resource.js");
class CNIs extends resource_1.APIResource {
    /**
     * Create a new CNI object
     *
     * @example
     * ```ts
     * const cni = await client.networkInterconnects.cnis.create({
     *   account_id: 'account_id',
     *   account: 'account',
     *   interconnect: 'interconnect',
     *   magic: {
     *     conduit_name: 'conduit_name',
     *     description: 'description',
     *     mtu: 0,
     *   },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cni/cnis`, { body, ...options });
    }
    /**
     * Modify stored information about a CNI object
     *
     * @example
     * ```ts
     * const cni = await client.networkInterconnects.cnis.update(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   {
     *     account_id: 'account_id',
     *     id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     account: 'account',
     *     cust_ip: '192.168.3.4/31',
     *     interconnect: 'interconnect',
     *     magic: {
     *       conduit_name: 'conduit_name',
     *       description: 'description',
     *       mtu: 0,
     *     },
     *     p2p_ip: '192.168.3.4/31',
     *   },
     * );
     * ```
     */
    update(cni, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cni/cnis/${cni}`, { body, ...options });
    }
    /**
     * List existing CNI objects
     *
     * @example
     * ```ts
     * const cnis = await client.networkInterconnects.cnis.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/cni/cnis`, { query, ...options });
    }
    /**
     * Delete a specified CNI object
     *
     * @example
     * ```ts
     * await client.networkInterconnects.cnis.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(cni, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cni/cnis/${cni}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Get information about a CNI object
     *
     * @example
     * ```ts
     * const cni = await client.networkInterconnects.cnis.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(cni, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/cnis/${cni}`, options);
    }
}
exports.CNIs = CNIs;
//# sourceMappingURL=cnis.js.map