"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppTypesSinglePage = exports.AppTypes = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class AppTypes extends resource_1.APIResource {
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
exports.AppTypes = AppTypes;
class AppTypesSinglePage extends pagination_1.SinglePage {
}
exports.AppTypesSinglePage = AppTypesSinglePage;
AppTypes.AppTypesSinglePage = AppTypesSinglePage;
//# sourceMappingURL=app-types.js.map