// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Sinkholes extends APIResource {
    /**
     * List sinkholes owned by this account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const sinkhole of client.intel.sinkholes.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/sinkholes`, SinkholesSinglePage, options);
    }
}
export class SinkholesSinglePage extends SinglePage {
}
Sinkholes.SinkholesSinglePage = SinkholesSinglePage;
//# sourceMappingURL=sinkholes.mjs.map