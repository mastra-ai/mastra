// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Colos extends APIResource {
    /**
     * List Cloudflare colos that account's devices were connected to during a time
     * period, sorted by usage starting from the most used colo. Colos without traffic
     * are also returned and sorted alphabetically.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const coloListResponse of client.zeroTrust.dex.colos.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     from: '2023-08-20T20:45:00Z',
     *     to: '2023-08-24T20:45:00Z',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/colos`, ColoListResponsesSinglePage, {
            query,
            ...options,
        });
    }
}
export class ColoListResponsesSinglePage extends SinglePage {
}
Colos.ColoListResponsesSinglePage = ColoListResponsesSinglePage;
//# sourceMappingURL=colos.mjs.map