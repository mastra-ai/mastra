import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class ASN extends APIResource {
    /**
     * Gets all the data the botnet tracking database has for a given ASN registered to
     * user account for given date. If no date is given, it will return results for the
     * previous day.
     */
    dayReport(asnId: number, params: ASNDayReportParams, options?: Core.RequestOptions): Core.APIPromise<ASNDayReportResponse>;
    /**
     * Gets all the data the botnet threat feed tracking database has for a given ASN
     * registered to user account.
     */
    fullReport(asnId: number, params: ASNFullReportParams, options?: Core.RequestOptions): Core.APIPromise<ASNFullReportResponse>;
}
export interface ASNDayReportResponse {
    cidr?: string;
    date?: string;
    offense_count?: number;
}
export interface ASNFullReportResponse {
    cidr?: string;
    date?: string;
    offense_count?: number;
}
export interface ASNDayReportParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param:
     */
    date?: string;
}
export interface ASNFullReportParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace ASN {
    export { type ASNDayReportResponse as ASNDayReportResponse, type ASNFullReportResponse as ASNFullReportResponse, type ASNDayReportParams as ASNDayReportParams, type ASNFullReportParams as ASNFullReportParams, };
}
//# sourceMappingURL=asn.d.ts.map