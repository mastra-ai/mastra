// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Settings extends APIResource {
    /**
     * Patch script-level settings when using
     * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions).
     * Including but not limited to Logpush and Tail Consumers.
     *
     * @example
     * ```ts
     * const scriptSetting =
     *   await client.workers.scripts.settings.edit(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workers/scripts/${scriptName}/script-settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get script-level settings when using
     * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions).
     * Includes Logpush and Tail Consumers.
     *
     * @example
     * ```ts
     * const scriptSetting =
     *   await client.workers.scripts.settings.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/script-settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=settings.mjs.map