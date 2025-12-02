// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class AppTypes extends APIResource {
    /**
     * Fetches all application and application type mappings.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const appType of client.zeroTrust.gateway.appTypes.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/app_types`, AppTypesSinglePage, options);
    }
}
export class AppTypesSinglePage extends SinglePage {
}
AppTypes.AppTypesSinglePage = AppTypesSinglePage;
//# sourceMappingURL=app-types.mjs.map