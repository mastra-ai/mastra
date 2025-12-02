import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Move extends APIResource {
    /**
     * Move a message
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const moveCreateResponse of client.emailSecurity.investigate.move.create(
     *   '4Njp3P0STMz2c02Q',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination: 'Inbox',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(postfixId: string, params: MoveCreateParams, options?: Core.RequestOptions): Core.PagePromise<MoveCreateResponsesSinglePage, MoveCreateResponse>;
    /**
     * Move multiple messages
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const moveBulkResponse of client.emailSecurity.investigate.move.bulk(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination: 'Inbox',
     *     postfix_ids: ['4Njp3P0STMz2c02Q'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulk(params: MoveBulkParams, options?: Core.RequestOptions): Core.PagePromise<MoveBulkResponsesSinglePage, MoveBulkResponse>;
}
export declare class MoveCreateResponsesSinglePage extends SinglePage<MoveCreateResponse> {
}
export declare class MoveBulkResponsesSinglePage extends SinglePage<MoveBulkResponse> {
}
export interface MoveCreateResponse {
    completed_timestamp: string;
    item_count: number;
    destination?: string | null;
    message_id?: string | null;
    operation?: string | null;
    recipient?: string | null;
    status?: string | null;
}
export interface MoveBulkResponse {
    completed_timestamp: string;
    item_count: number;
    destination?: string | null;
    message_id?: string | null;
    operation?: string | null;
    recipient?: string | null;
    status?: string | null;
}
export interface MoveCreateParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    destination: 'Inbox' | 'JunkEmail' | 'DeletedItems' | 'RecoverableItemsDeletions' | 'RecoverableItemsPurges';
}
export interface MoveBulkParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    destination: 'Inbox' | 'JunkEmail' | 'DeletedItems' | 'RecoverableItemsDeletions' | 'RecoverableItemsPurges';
    /**
     * Body param:
     */
    postfix_ids: Array<string>;
}
export declare namespace Move {
    export { type MoveCreateResponse as MoveCreateResponse, type MoveBulkResponse as MoveBulkResponse, MoveCreateResponsesSinglePage as MoveCreateResponsesSinglePage, MoveBulkResponsesSinglePage as MoveBulkResponsesSinglePage, type MoveCreateParams as MoveCreateParams, type MoveBulkParams as MoveBulkParams, };
}
//# sourceMappingURL=move.d.ts.map