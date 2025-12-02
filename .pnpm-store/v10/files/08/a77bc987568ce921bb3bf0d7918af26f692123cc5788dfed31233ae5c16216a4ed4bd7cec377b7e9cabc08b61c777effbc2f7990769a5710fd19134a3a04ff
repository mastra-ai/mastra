import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Responses extends APIResource {
    /**
     * Returns the raw response of the network request. Find the `response_id` in the
     * `data.requests.response.hash`.
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.responses.get(
     *   'response_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(responseId: string, params: ResponseGetParams, options?: Core.RequestOptions): Core.APIPromise<string>;
}
/**
 * Web resource or image.
 */
export type ResponseGetResponse = string;
export interface ResponseGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Responses {
    export { type ResponseGetResponse as ResponseGetResponse, type ResponseGetParams as ResponseGetParams };
}
//# sourceMappingURL=responses.d.ts.map