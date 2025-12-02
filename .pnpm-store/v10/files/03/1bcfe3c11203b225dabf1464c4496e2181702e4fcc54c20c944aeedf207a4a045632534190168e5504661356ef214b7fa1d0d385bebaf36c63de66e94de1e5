// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Settings extends APIResource {
    /**
     * Update the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.update({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cni/settings`, { body, ...options });
    }
    /**
     * Get the current settings for the active account
     *
     * @example
     * ```ts
     * const setting =
     *   await client.networkInterconnects.settings.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cni/settings`, options);
    }
}
//# sourceMappingURL=settings.mjs.map