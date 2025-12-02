// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class References extends APIResource {
    /**
     * Get the list of resources that reference the provided monitor.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const referenceGetResponse of client.loadBalancers.monitors.references.get(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(monitorId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/monitors/${monitorId}/references`, ReferenceGetResponsesSinglePage, options);
    }
}
export class ReferenceGetResponsesSinglePage extends SinglePage {
}
References.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;
//# sourceMappingURL=references.mjs.map