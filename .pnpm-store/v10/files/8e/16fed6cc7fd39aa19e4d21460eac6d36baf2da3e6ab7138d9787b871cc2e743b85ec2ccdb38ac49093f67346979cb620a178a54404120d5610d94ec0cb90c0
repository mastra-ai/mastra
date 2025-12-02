import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class TURN extends APIResource {
    /**
     * Creates a new Cloudflare Calls TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: TURNCreateParams, options?: Core.RequestOptions): Core.APIPromise<TURNCreateResponse>;
    /**
     * Edit details for a single TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.update(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(keyId: string, params: TURNUpdateParams, options?: Core.RequestOptions): Core.APIPromise<TURNUpdateResponse>;
    /**
     * Lists all TURN keys in the Cloudflare account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const turnListResponse of client.calls.turn.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: TURNListParams, options?: Core.RequestOptions): Core.PagePromise<TURNListResponsesSinglePage, TURNListResponse>;
    /**
     * Deletes a TURN key from Cloudflare Calls
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.delete(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(keyId: string, params: TURNDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TURNDeleteResponse>;
    /**
     * Fetches details for a single TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.get(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(keyId: string, params: TURNGetParams, options?: Core.RequestOptions): Core.APIPromise<TURNGetResponse>;
}
export declare class TURNListResponsesSinglePage extends SinglePage<TURNListResponse> {
}
export interface TURNCreateResponse {
    /**
     * The date and time the item was created.
     */
    created?: string;
    /**
     * Bearer token
     */
    key?: string;
    /**
     * The date and time the item was last modified.
     */
    modified?: string;
    /**
     * A short description of a TURN key, not shown to end users.
     */
    name?: string;
    /**
     * A Cloudflare-generated unique identifier for a item.
     */
    uid?: string;
}
export interface TURNUpdateResponse {
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
export interface TURNListResponse {
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
export interface TURNDeleteResponse {
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
export interface TURNGetResponse {
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
export interface TURNCreateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: A short description of a TURN key, not shown to end users.
     */
    name?: string;
}
export interface TURNUpdateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: A short description of a TURN key, not shown to end users.
     */
    name?: string;
}
export interface TURNListParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface TURNDeleteParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface TURNGetParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export declare namespace TURN {
    export { type TURNCreateResponse as TURNCreateResponse, type TURNUpdateResponse as TURNUpdateResponse, type TURNListResponse as TURNListResponse, type TURNDeleteResponse as TURNDeleteResponse, type TURNGetResponse as TURNGetResponse, TURNListResponsesSinglePage as TURNListResponsesSinglePage, type TURNCreateParams as TURNCreateParams, type TURNUpdateParams as TURNUpdateParams, type TURNListParams as TURNListParams, type TURNDeleteParams as TURNDeleteParams, type TURNGetParams as TURNGetParams, };
}
//# sourceMappingURL=turn.d.ts.map