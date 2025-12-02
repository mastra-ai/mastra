// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as Core from "../../../../../core.mjs";
export class Settings extends APIResource {
    /**
     * Patch script metadata, such as bindings.
     *
     * @example
     * ```ts
     * const response =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.settings.edit(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(dispatchNamespace, scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/settings`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get script settings from a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.settings.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=settings.mjs.map