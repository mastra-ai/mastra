import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Keys extends APIResource {
    /**
     * Create a new signing key with specified name. Returns all keys available.
     *
     * @example
     * ```ts
     * const key = await client.images.v1.keys.update('someKey', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(signingKeyName: string, params: KeyUpdateParams, options?: Core.RequestOptions): Core.APIPromise<KeyUpdateResponse>;
    /**
     * Lists your signing keys. These can be found on your Cloudflare Images dashboard.
     *
     * @example
     * ```ts
     * const keys = await client.images.v1.keys.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params: KeyListParams, options?: Core.RequestOptions): Core.APIPromise<KeyListResponse>;
    /**
     * Delete signing key with specified name. Returns all keys available. When last
     * key is removed, a new default signing key will be generated.
     *
     * @example
     * ```ts
     * const key = await client.images.v1.keys.delete('someKey', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(signingKeyName: string, params: KeyDeleteParams, options?: Core.RequestOptions): Core.APIPromise<KeyDeleteResponse>;
}
export interface Key {
    /**
     * Key name.
     */
    name?: string;
    /**
     * Key value.
     */
    value?: string;
}
export interface KeyUpdateResponse {
    keys?: Array<Key>;
}
export interface KeyListResponse {
    keys?: Array<Key>;
}
export interface KeyDeleteResponse {
    keys?: Array<Key>;
}
export interface KeyUpdateParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface KeyListParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface KeyDeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace Keys {
    export { type Key as Key, type KeyUpdateResponse as KeyUpdateResponse, type KeyListResponse as KeyListResponse, type KeyDeleteResponse as KeyDeleteResponse, type KeyUpdateParams as KeyUpdateParams, type KeyListParams as KeyListParams, type KeyDeleteParams as KeyDeleteParams, };
}
//# sourceMappingURL=keys.d.ts.map