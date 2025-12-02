// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Interconnects extends APIResource {
    /**
     * Create a new interconnect
     *
     * @example
     * ```ts
     * const interconnect =
     *   await client.networkInterconnects.interconnects.create({
     *     account_id: 'account_id',
     *     account: 'account',
     *     slot_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     type: 'type',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cni/interconnects`, { body, ...options });
    }
    /**
     * List existing interconnects
     *
     * @example
     * ```ts
     * const interconnects =
     *   await client.networkInterconnects.interconnects.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/cni/interconnects`, { query, ...options });
    }
    /**
     * Delete an interconnect object
     *
     * @example
     * ```ts
     * await client.networkInterconnects.interconnects.delete(
     *   'icon',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(icon, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cni/interconnects/${icon}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Get information about an interconnect object
     *
     * @example
     * ```ts
     * const interconnect =
     *   await client.networkInterconnects.interconnects.get(
     *     'icon',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(icon, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/interconnects/${icon}`, options);
    }
    /**
     * Generate the Letter of Authorization (LOA) for a given interconnect
     *
     * @example
     * ```ts
     * await client.networkInterconnects.interconnects.loa(
     *   'icon',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    loa(icon, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/interconnects/${icon}/loa`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Get the current status of an interconnect object
     *
     * @example
     * ```ts
     * const response =
     *   await client.networkInterconnects.interconnects.status(
     *     'icon',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    status(icon, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/interconnects/${icon}/status`, options);
    }
}
//# sourceMappingURL=interconnects.mjs.map