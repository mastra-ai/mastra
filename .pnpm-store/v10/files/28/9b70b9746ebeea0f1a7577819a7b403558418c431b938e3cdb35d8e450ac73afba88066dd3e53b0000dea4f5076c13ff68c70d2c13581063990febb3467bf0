// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class ScriptAndVersionSettings extends APIResource {
    /**
     * Patch metadata or config, such as bindings or usage model.
     *
     * @example
     * ```ts
     * const response =
     *   await client.workers.scripts.scriptAndVersionSettings.edit(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workers/scripts/${scriptName}/settings`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get metadata and config, such as bindings or usage model.
     *
     * @example
     * ```ts
     * const scriptAndVersionSetting =
     *   await client.workers.scripts.scriptAndVersionSettings.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=script-and-version-settings.mjs.map