// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { SinglePage } from "../../../../../pagination.mjs";
export class Bindings extends APIResource {
    /**
     * Fetch script bindings from a script uploaded to a Workers for Platforms
     * namespace.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const bindingGetResponse of client.workersForPlatforms.dispatch.namespaces.scripts.bindings.get(
     *   'my-dispatch-namespace',
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/bindings`, BindingGetResponsesSinglePage, options);
    }
}
export class BindingGetResponsesSinglePage extends SinglePage {
}
Bindings.BindingGetResponsesSinglePage = BindingGetResponsesSinglePage;
//# sourceMappingURL=bindings.mjs.map