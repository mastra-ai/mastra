// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as FullAPI from "./full.mjs";
import { Full } from "./full.mjs";
export class Configs extends APIResource {
    constructor() {
        super(...arguments);
        this.full = new FullAPI.Full(this._client);
    }
    /**
     * Create a new network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.create({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     default_sampling: 1,
     *     name: "cloudflare user's account",
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing network monitoring configuration, requires the entire
     * configuration to be updated at once.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.update({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     default_sampling: 1,
     *     name: "cloudflare user's account",
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete an existing network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.delete({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/mnm/config`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update fields in an existing network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.edit({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists default sampling, router IPs and warp devices for account.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.get({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mnm/config`, options)._thenUnwrap((obj) => obj.result);
    }
}
Configs.Full = Full;
//# sourceMappingURL=configs.mjs.map