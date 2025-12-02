import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Recipients extends APIResource {
    /**
     * Create a new share recipient
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.create(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { path_account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(shareId: string, params: RecipientCreateParams, options?: Core.RequestOptions): Core.APIPromise<RecipientCreateResponse>;
    /**
     * List share recipients by share ID.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const recipientListResponse of client.resourceSharing.recipients.list(
     *   '3fd85f74b32742f1bff64a85009dda07',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(shareId: string, params: RecipientListParams, options?: Core.RequestOptions): Core.PagePromise<RecipientListResponsesV4PagePaginationArray, RecipientListResponse>;
    /**
     * Deletion is not immediate, an updated share recipient object with a new status
     * will be returned.
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.delete(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(shareId: string, recipientId: string, params: RecipientDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RecipientDeleteResponse>;
    /**
     * Get share recipient by ID.
     *
     * @example
     * ```ts
     * const recipient =
     *   await client.resourceSharing.recipients.get(
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     '3fd85f74b32742f1bff64a85009dda07',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(shareId: string, recipientId: string, params: RecipientGetParams, options?: Core.RequestOptions): Core.APIPromise<RecipientGetResponse>;
}
export declare class RecipientListResponsesV4PagePaginationArray extends V4PagePaginationArray<RecipientListResponse> {
}
export interface RecipientCreateResponse {
    /**
     * Share Recipient identifier tag.
     */
    id: string;
    /**
     * Account identifier.
     */
    account_id: string;
    /**
     * Share Recipient association status.
     */
    association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';
    /**
     * When the share was created.
     */
    created: string;
    /**
     * When the share was modified.
     */
    modified: string;
    /**
     * Share Recipient status message.
     */
    status_message: string;
}
export interface RecipientListResponse {
    /**
     * Share Recipient identifier tag.
     */
    id: string;
    /**
     * Account identifier.
     */
    account_id: string;
    /**
     * Share Recipient association status.
     */
    association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';
    /**
     * When the share was created.
     */
    created: string;
    /**
     * When the share was modified.
     */
    modified: string;
    /**
     * Share Recipient status message.
     */
    status_message: string;
}
export interface RecipientDeleteResponse {
    /**
     * Share Recipient identifier tag.
     */
    id: string;
    /**
     * Account identifier.
     */
    account_id: string;
    /**
     * Share Recipient association status.
     */
    association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';
    /**
     * When the share was created.
     */
    created: string;
    /**
     * When the share was modified.
     */
    modified: string;
    /**
     * Share Recipient status message.
     */
    status_message: string;
}
export interface RecipientGetResponse {
    /**
     * Share Recipient identifier tag.
     */
    id: string;
    /**
     * Account identifier.
     */
    account_id: string;
    /**
     * Share Recipient association status.
     */
    association_status: 'associating' | 'associated' | 'disassociating' | 'disassociated';
    /**
     * When the share was created.
     */
    created: string;
    /**
     * When the share was modified.
     */
    modified: string;
    /**
     * Share Recipient status message.
     */
    status_message: string;
}
export interface RecipientCreateParams {
    /**
     * Path param: Account identifier.
     */
    path_account_id: string;
    /**
     * Body param: Account identifier.
     */
    body_account_id?: string;
    /**
     * Body param: Organization identifier.
     */
    organization_id?: string;
}
export interface RecipientListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier.
     */
    account_id: string;
}
export interface RecipientDeleteParams {
    /**
     * Account identifier.
     */
    account_id: string;
}
export interface RecipientGetParams {
    /**
     * Account identifier.
     */
    account_id: string;
}
export declare namespace Recipients {
    export { type RecipientCreateResponse as RecipientCreateResponse, type RecipientListResponse as RecipientListResponse, type RecipientDeleteResponse as RecipientDeleteResponse, type RecipientGetResponse as RecipientGetResponse, RecipientListResponsesV4PagePaginationArray as RecipientListResponsesV4PagePaginationArray, type RecipientCreateParams as RecipientCreateParams, type RecipientListParams as RecipientListParams, type RecipientDeleteParams as RecipientDeleteParams, type RecipientGetParams as RecipientGetParams, };
}
//# sourceMappingURL=recipients.d.ts.map