import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import { SinglePage } from "../../../../../pagination.js";
export declare class Updates extends APIResource {
    /**
     * Lists Access SCIM update logs that maintain a record of updates made to User and
     * Group resources synced to Cloudflare via the System for Cross-domain Identity
     * Management (SCIM).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const updateListResponse of client.zeroTrust.access.logs.scim.updates.list(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     idp_id: [
     *       'df7e2w5f-02b7-4d9d-af26-8d1988fca630',
     *       '0194ae2c-efcf-7cfb-8884-055f1a161fa5',
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: UpdateListParams, options?: Core.RequestOptions): Core.PagePromise<UpdateListResponsesSinglePage, UpdateListResponse>;
}
export declare class UpdateListResponsesSinglePage extends SinglePage<UpdateListResponse> {
}
export interface UpdateListResponse {
    /**
     * The unique Cloudflare-generated Id of the SCIM resource.
     */
    cf_resource_id?: string;
    /**
     * The error message which is generated when the status of the SCIM request is
     * 'FAILURE'.
     */
    error_description?: string;
    /**
     * The unique Id of the IdP that has SCIM enabled.
     */
    idp_id?: string;
    /**
     * The IdP-generated Id of the SCIM resource.
     */
    idp_resource_id?: string;
    logged_at?: string;
    /**
     * The JSON-encoded string body of the SCIM request.
     */
    request_body?: string;
    /**
     * The request method of the SCIM request.
     */
    request_method?: string;
    /**
     * The display name of the SCIM Group resource if it exists.
     */
    resource_group_name?: string;
    /**
     * The resource type of the SCIM request.
     */
    resource_type?: string;
    /**
     * The email address of the SCIM User resource if it exists.
     */
    resource_user_email?: string;
    /**
     * The status of the SCIM request.
     */
    status?: string;
}
export interface UpdateListParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: The unique Id of the IdP that has SCIM enabled.
     */
    idp_id: Array<string>;
    /**
     * Query param: The unique Cloudflare-generated Id of the SCIM resource.
     */
    cf_resource_id?: string;
    /**
     * Query param: The chronological order used to sort the logs.
     */
    direction?: 'desc' | 'asc';
    /**
     * Query param: The IdP-generated Id of the SCIM resource.
     */
    idp_resource_id?: string;
    /**
     * Query param: The maximum number of update logs to retrieve.
     */
    limit?: number;
    /**
     * Query param: The request method of the SCIM request.
     */
    request_method?: Array<'DELETE' | 'PATCH' | 'POST' | 'PUT'>;
    /**
     * Query param: The display name of the SCIM Group resource.
     */
    resource_group_name?: string;
    /**
     * Query param: The resource type of the SCIM request.
     */
    resource_type?: Array<'USER' | 'GROUP'>;
    /**
     * Query param: The email address of the SCIM User resource.
     */
    resource_user_email?: string;
    /**
     * Query param: the timestamp of the earliest update log.
     */
    since?: string;
    /**
     * Query param: The status of the SCIM request.
     */
    status?: Array<'FAILURE' | 'SUCCESS'>;
    /**
     * Query param: the timestamp of the most-recent update log.
     */
    until?: string;
}
export declare namespace Updates {
    export { type UpdateListResponse as UpdateListResponse, UpdateListResponsesSinglePage as UpdateListResponsesSinglePage, type UpdateListParams as UpdateListParams, };
}
//# sourceMappingURL=updates.d.ts.map