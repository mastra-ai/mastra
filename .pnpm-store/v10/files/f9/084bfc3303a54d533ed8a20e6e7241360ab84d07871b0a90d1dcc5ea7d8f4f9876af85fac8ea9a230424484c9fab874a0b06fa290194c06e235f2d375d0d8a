import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class SFU extends APIResource {
    /**
     * Creates a new Cloudflare calls app. An app is an unique enviroment where each
     * Session can access all Tracks within the app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: SFUCreateParams, options?: Core.RequestOptions): Core.APIPromise<SFUCreateResponse>;
    /**
     * Edit details for a single app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.update(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(appId: string, params: SFUUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SFUUpdateResponse>;
    /**
     * Lists all apps in the Cloudflare account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const sfuListResponse of client.calls.sfu.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: SFUListParams, options?: Core.RequestOptions): Core.PagePromise<SFUListResponsesSinglePage, SFUListResponse>;
    /**
     * Deletes an app from Cloudflare Calls
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.delete(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(appId: string, params: SFUDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SFUDeleteResponse>;
    /**
     * Fetches details for a single Calls app.
     *
     * @example
     * ```ts
     * const sfu = await client.calls.sfu.get(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(appId: string, params: SFUGetParams, options?: Core.RequestOptions): Core.APIPromise<SFUGetResponse>;
}
export declare class SFUListResponsesSinglePage extends SinglePage<SFUListResponse> {
}
export interface SFUCreateResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of Calls app, not shown to end users.
     */
    name?: string;
    /**
     * Bearer token
     */
    secret?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface SFUUpdateResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of Calls app, not shown to end users.
     */
    name?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface SFUListResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of Calls app, not shown to end users.
     */
    name?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface SFUDeleteResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of Calls app, not shown to end users.
     */
    name?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface SFUGetResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of Calls app, not shown to end users.
     */
    name?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface SFUCreateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: A short description of Calls app, not shown to end users.
     */
    name?: string;
}
export interface SFUUpdateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: A short description of Calls app, not shown to end users.
     */
    name?: string;
}
export interface SFUListParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface SFUDeleteParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface SFUGetParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export declare namespace SFU {
    export { type SFUCreateResponse as SFUCreateResponse, type SFUUpdateResponse as SFUUpdateResponse, type SFUListResponse as SFUListResponse, type SFUDeleteResponse as SFUDeleteResponse, type SFUGetResponse as SFUGetResponse, SFUListResponsesSinglePage as SFUListResponsesSinglePage, type SFUCreateParams as SFUCreateParams, type SFUUpdateParams as SFUUpdateParams, type SFUListParams as SFUListParams, type SFUDeleteParams as SFUDeleteParams, type SFUGetParams as SFUGetParams, };
}
//# sourceMappingURL=sfu.d.ts.map