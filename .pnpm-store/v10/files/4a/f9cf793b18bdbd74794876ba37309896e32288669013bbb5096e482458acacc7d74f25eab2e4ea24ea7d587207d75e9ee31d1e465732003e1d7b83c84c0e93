import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Reclassify extends APIResource {
    /**
     * Change email classfication
     *
     * @example
     * ```ts
     * const reclassify =
     *   await client.emailSecurity.investigate.reclassify.create(
     *     '4Njp3P0STMz2c02Q',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       expected_disposition: 'NONE',
     *     },
     *   );
     * ```
     */
    create(postfixId: string, params: ReclassifyCreateParams, options?: Core.RequestOptions): Core.APIPromise<ReclassifyCreateResponse>;
}
export type ReclassifyCreateResponse = unknown;
export interface ReclassifyCreateParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    expected_disposition: 'NONE' | 'BULK' | 'MALICIOUS' | 'SPAM' | 'SPOOF' | 'SUSPICIOUS';
    /**
     * Body param: Base64 encoded content of the EML file
     */
    eml_content?: string | null;
}
export declare namespace Reclassify {
    export { type ReclassifyCreateResponse as ReclassifyCreateResponse, type ReclassifyCreateParams as ReclassifyCreateParams, };
}
//# sourceMappingURL=reclassify.d.ts.map