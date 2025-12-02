import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Raw extends APIResource {
    /**
     * Returns the raw eml of any non-benign message.
     *
     * @example
     * ```ts
     * const raw = await client.emailSecurity.investigate.raw.get(
     *   '4Njp3P0STMz2c02Q',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(postfixId: string, params: RawGetParams, options?: Core.RequestOptions): Core.APIPromise<RawGetResponse>;
}
export interface RawGetResponse {
    /**
     * A UTF-8 encoded eml file of the email.
     */
    raw: string;
}
export interface RawGetParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Raw {
    export { type RawGetResponse as RawGetResponse, type RawGetParams as RawGetParams };
}
//# sourceMappingURL=raw.d.ts.map