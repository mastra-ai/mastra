// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Services extends APIResource {
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
export class ServiceListResponsesSinglePage extends SinglePage {
}
Services.ServiceListResponsesSinglePage = ServiceListResponsesSinglePage;
//# sourceMappingURL=services.mjs.map