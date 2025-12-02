// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ScriptsAPI from "./scripts/scripts.mjs";
import { Scripts, } from "./scripts/scripts.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Namespaces extends APIResource {
    constructor() {
        super(...arguments);
        this.scripts = new ScriptsAPI.Scripts(this._client);
    }
    /**
     * Create a new Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.create(
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/dispatch/namespaces`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a list of Workers for Platforms namespaces.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const namespaceListResponse of client.workersForPlatforms.dispatch.namespaces.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/dispatch/namespaces`, NamespaceListResponsesSinglePage, options);
    }
    /**
     * Delete a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.delete(
     *     'my-dispatch-namespace',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(dispatchNamespace, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.get(
     *     'my-dispatch-namespace',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class NamespaceListResponsesSinglePage extends SinglePage {
}
Namespaces.NamespaceListResponsesSinglePage = NamespaceListResponsesSinglePage;
Namespaces.Scripts = Scripts;
//# sourceMappingURL=namespaces.mjs.map