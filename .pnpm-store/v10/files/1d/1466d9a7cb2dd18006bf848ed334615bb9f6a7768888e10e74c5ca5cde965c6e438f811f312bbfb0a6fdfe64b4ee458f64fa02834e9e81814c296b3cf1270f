import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class PayloadLogs extends APIResource {
    /**
     * Set payload log settings
     *
     * @example
     * ```ts
     * const payloadLog =
     *   await client.zeroTrust.dlp.payloadLogs.update({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    update(params: PayloadLogUpdateParams, options?: Core.RequestOptions): Core.APIPromise<PayloadLogUpdateResponse>;
    /**
     * Get payload log settings
     *
     * @example
     * ```ts
     * const payloadLog =
     *   await client.zeroTrust.dlp.payloadLogs.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params: PayloadLogGetParams, options?: Core.RequestOptions): Core.APIPromise<PayloadLogGetResponse>;
}
export interface PayloadLogUpdateResponse {
    updated_at: string;
    public_key?: string | null;
}
export interface PayloadLogGetResponse {
    updated_at: string;
    public_key?: string | null;
}
export interface PayloadLogUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    public_key?: string | null;
}
export interface PayloadLogGetParams {
    account_id: string;
}
export declare namespace PayloadLogs {
    export { type PayloadLogUpdateResponse as PayloadLogUpdateResponse, type PayloadLogGetResponse as PayloadLogGetResponse, type PayloadLogUpdateParams as PayloadLogUpdateParams, type PayloadLogGetParams as PayloadLogGetParams, };
}
//# sourceMappingURL=payload-logs.d.ts.map