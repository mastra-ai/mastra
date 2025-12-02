"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceListResponsesSinglePage = exports.Services = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Services extends resource_1.APIResource {
    /**
     * Bring-Your-Own IP (BYOIP) prefixes onboarded to Cloudflare must be bound to a
     * service running on the Cloudflare network to enable a Cloudflare product on the
     * IP addresses. This endpoint can be used as a reference of available services on
     * the Cloudflare network, and their service IDs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const serviceListResponse of client.addressing.services.list(
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/services`, ServiceListResponsesSinglePage, options);
    }
}
exports.Services = Services;
class ServiceListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ServiceListResponsesSinglePage = ServiceListResponsesSinglePage;
Services.ServiceListResponsesSinglePage = ServiceListResponsesSinglePage;
//# sourceMappingURL=services.js.map