import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Preview extends APIResource {
    /**
     * Preview for non-detection messages
     *
     * @example
     * ```ts
     * const preview =
     *   await client.emailSecurity.investigate.preview.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     postfix_id: '4Njp3P0STMz2c02Q',
     *   });
     * ```
     */
    create(params: PreviewCreateParams, options?: Core.RequestOptions): Core.APIPromise<PreviewCreateResponse>;
    /**
     * Returns a preview of the message body as a base64 encoded PNG image for
     * non-benign messages.
     *
     * @example
     * ```ts
     * const preview =
     *   await client.emailSecurity.investigate.preview.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId: string, params: PreviewGetParams, options?: Core.RequestOptions): Core.APIPromise<PreviewGetResponse>;
}
export interface PreviewCreateResponse {
    /**
     * A base64 encoded PNG image of the email.
     */
    screenshot: string;
}
export interface PreviewGetResponse {
    /**
     * A base64 encoded PNG image of the email.
     */
    screenshot: string;
}
export interface PreviewCreateParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param: The identifier of the message.
     */
    postfix_id: string;
}
export interface PreviewGetParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Preview {
    export { type PreviewCreateResponse as PreviewCreateResponse, type PreviewGetResponse as PreviewGetResponse, type PreviewCreateParams as PreviewCreateParams, type PreviewGetParams as PreviewGetParams, };
}
//# sourceMappingURL=preview.d.ts.map