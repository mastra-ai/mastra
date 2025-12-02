"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const resource_1 = require("../../../../resource.js");
class Config extends resource_1.APIResource {
    /**
     * Updates CMB config.
     *
     * @example
     * ```ts
     * const cmbConfig =
     *   await client.logs.control.cmb.config.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/logs/control/cmb/config`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes CMB config.
     *
     * @example
     * ```ts
     * const config = await client.logs.control.cmb.config.delete({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/logs/control/cmb/config`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets CMB config.
     *
     * @example
     * ```ts
     * const cmbConfig = await client.logs.control.cmb.config.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/logs/control/cmb/config`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map