"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BindingGetResponsesSinglePage = exports.Bindings = void 0;
const resource_1 = require("../../../../../resource.js");
const pagination_1 = require("../../../../../pagination.js");
class Bindings extends resource_1.APIResource {
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
exports.Bindings = Bindings;
class BindingGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.BindingGetResponsesSinglePage = BindingGetResponsesSinglePage;
Bindings.BindingGetResponsesSinglePage = BindingGetResponsesSinglePage;
//# sourceMappingURL=bindings.js.map