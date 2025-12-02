import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Services extends APIResource {
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
    list(params: ServiceListParams, options?: Core.RequestOptions): Core.PagePromise<ServiceListResponsesSinglePage, ServiceListResponse>;
}
export declare class ServiceListResponsesSinglePage extends SinglePage<ServiceListResponse> {
}
export interface ServiceListResponse {
    /**
     * Identifier of a Service on the Cloudflare network. Available services and their
     * IDs may be found in the **List Services** endpoint.
     */
    id?: string;
    /**
     * Name of a service running on the Cloudflare network
     */
    name?: string;
}
export interface ServiceListParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace Services {
    export { type ServiceListResponse as ServiceListResponse, ServiceListResponsesSinglePage as ServiceListResponsesSinglePage, type ServiceListParams as ServiceListParams, };
}
//# sourceMappingURL=services.d.ts.map