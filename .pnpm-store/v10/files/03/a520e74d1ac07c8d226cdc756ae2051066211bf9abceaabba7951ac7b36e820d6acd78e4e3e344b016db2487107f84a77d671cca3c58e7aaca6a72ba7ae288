import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class AdvertisementStatus extends APIResource {
    /**
     * Advertise or withdraw the BGP route for a prefix.
     *
     * **Deprecated:** Prefer the BGP Prefixes endpoints, which additionally allow for
     * advertising and withdrawing subnets of an IP prefix.
     *
     * @deprecated
     */
    edit(prefixId: string, params: AdvertisementStatusEditParams, options?: Core.RequestOptions): Core.APIPromise<AdvertisementStatusEditResponse>;
    /**
     * View the current advertisement state for a prefix.
     *
     * **Deprecated:** Prefer the BGP Prefixes endpoints, which additionally allow for
     * advertising and withdrawing subnets of an IP prefix.
     *
     * @deprecated
     */
    get(prefixId: string, params: AdvertisementStatusGetParams, options?: Core.RequestOptions): Core.APIPromise<AdvertisementStatusGetResponse>;
}
export interface AdvertisementStatusEditResponse {
    /**
     * Advertisement status of the prefix. If `true`, the BGP route for the prefix is
     * advertised to the Internet. If `false`, the BGP route is withdrawn.
     */
    advertised?: boolean;
    /**
     * Last time the advertisement status was changed. This field is only not 'null' if
     * on demand is enabled.
     */
    advertised_modified_at?: string | null;
}
export interface AdvertisementStatusGetResponse {
    /**
     * Advertisement status of the prefix. If `true`, the BGP route for the prefix is
     * advertised to the Internet. If `false`, the BGP route is withdrawn.
     */
    advertised?: boolean;
    /**
     * Last time the advertisement status was changed. This field is only not 'null' if
     * on demand is enabled.
     */
    advertised_modified_at?: string | null;
}
export interface AdvertisementStatusEditParams {
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param: Advertisement status of the prefix. If `true`, the BGP route for the
     * prefix is advertised to the Internet. If `false`, the BGP route is withdrawn.
     */
    advertised: boolean;
}
export interface AdvertisementStatusGetParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace AdvertisementStatus {
    export { type AdvertisementStatusEditResponse as AdvertisementStatusEditResponse, type AdvertisementStatusGetResponse as AdvertisementStatusGetResponse, type AdvertisementStatusEditParams as AdvertisementStatusEditParams, type AdvertisementStatusGetParams as AdvertisementStatusGetParams, };
}
//# sourceMappingURL=advertisement-status.d.ts.map