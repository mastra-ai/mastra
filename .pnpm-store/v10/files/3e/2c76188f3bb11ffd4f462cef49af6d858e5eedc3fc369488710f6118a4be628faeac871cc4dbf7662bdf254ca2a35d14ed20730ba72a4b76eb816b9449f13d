// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Subdomain extends APIResource {
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
//# sourceMappingURL=subdomain.mjs.map