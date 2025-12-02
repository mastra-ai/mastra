import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class ASN extends APIResource {
    /**
     * Delete an ASN from botnet threat feed for a given user.
     */
    delete(asnId: number, params: ASNDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ASNDeleteResponse>;
    /**
     * Gets a list of all ASNs registered for a user for the DDoS Botnet Feed API.
     */
    get(params: ASNGetParams, options?: Core.RequestOptions): Core.APIPromise<ASNGetResponse>;
}
export interface ASNDeleteResponse {
    asn?: number;
}
export interface ASNGetResponse {
    asn?: number;
}
export interface ASNDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface ASNGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace ASN {
    export { type ASNDeleteResponse as ASNDeleteResponse, type ASNGetResponse as ASNGetResponse, type ASNDeleteParams as ASNDeleteParams, type ASNGetParams as ASNGetParams, };
}
//# sourceMappingURL=asn.d.ts.map