import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Release extends APIResource {
    /**
     * Release messages from quarantine
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const releaseBulkResponse of client.emailSecurity.investigate.release.bulk(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: ['4Njp3P0STMz2c02Q'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulk(params: ReleaseBulkParams, options?: Core.RequestOptions): Core.PagePromise<ReleaseBulkResponsesSinglePage, ReleaseBulkResponse>;
}
export declare class ReleaseBulkResponsesSinglePage extends SinglePage<ReleaseBulkResponse> {
}
export interface ReleaseBulkResponse {
    /**
     * The identifier of the message.
     */
    postfix_id: string;
    delivered?: Array<string> | null;
    failed?: Array<string> | null;
    undelivered?: Array<string> | null;
}
export interface ReleaseBulkParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param: A list of messages identfied by their `postfix_id`s that should be
     * released.
     */
    body: Array<string>;
}
export declare namespace Release {
    export { type ReleaseBulkResponse as ReleaseBulkResponse, ReleaseBulkResponsesSinglePage as ReleaseBulkResponsesSinglePage, type ReleaseBulkParams as ReleaseBulkParams, };
}
//# sourceMappingURL=release.d.ts.map