import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class HostnameAssociations extends APIResource {
    /**
     * Replace Hostname Associations
     */
    update(params: HostnameAssociationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<HostnameAssociationUpdateResponse>;
    /**
     * List Hostname Associations
     */
    get(params: HostnameAssociationGetParams, options?: Core.RequestOptions): Core.APIPromise<HostnameAssociationGetResponse>;
}
export type HostnameAssociation = string;
export type HostnameAssociationParam = string;
export interface TLSHostnameAssociation {
    hostnames?: Array<HostnameAssociation>;
    /**
     * The UUID for a certificate that was uploaded to the mTLS Certificate Management
     * endpoint. If no mtls_certificate_id is given, the hostnames will be associated
     * to your active Cloudflare Managed CA.
     */
    mtls_certificate_id?: string;
}
export interface HostnameAssociationUpdateResponse {
    hostnames?: Array<HostnameAssociation>;
}
export interface HostnameAssociationGetResponse {
    hostnames?: Array<HostnameAssociation>;
}
export interface HostnameAssociationUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    hostnames?: Array<HostnameAssociationParam>;
    /**
     * Body param: The UUID for a certificate that was uploaded to the mTLS Certificate
     * Management endpoint. If no mtls_certificate_id is given, the hostnames will be
     * associated to your active Cloudflare Managed CA.
     */
    mtls_certificate_id?: string;
}
export interface HostnameAssociationGetParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: The UUID to match against for a certificate that was uploaded to
     * the mTLS Certificate Management endpoint. If no mtls_certificate_id is given,
     * the results will be the hostnames associated to your active Cloudflare Managed
     * CA.
     */
    mtls_certificate_id?: string;
}
export declare namespace HostnameAssociations {
    export { type HostnameAssociation as HostnameAssociation, type TLSHostnameAssociation as TLSHostnameAssociation, type HostnameAssociationUpdateResponse as HostnameAssociationUpdateResponse, type HostnameAssociationGetResponse as HostnameAssociationGetResponse, type HostnameAssociationUpdateParams as HostnameAssociationUpdateParams, type HostnameAssociationGetParams as HostnameAssociationGetParams, };
}
//# sourceMappingURL=hostname-associations.d.ts.map