"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subdomain = void 0;
const resource_1 = require("../../../resource.js");
class Subdomain extends resource_1.APIResource {
    /**
     * Enable or disable the Worker on the workers.dev subdomain.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/subdomain`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disable all workers.dev subdomains for a Worker.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.delete(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(scriptName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}/subdomain`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get if the Worker is available on the workers.dev subdomain.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/subdomain`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Subdomain = Subdomain;
//# sourceMappingURL=subdomain.js.map