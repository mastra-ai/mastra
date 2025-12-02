import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Keys extends APIResource {
    /**
     * Updates the Access key rotation settings for an account.
     *
     * @example
     * ```ts
     * const key = await client.zeroTrust.access.keys.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   key_rotation_interval_days: 30,
     * });
     * ```
     */
    update(params: KeyUpdateParams, options?: Core.RequestOptions): Core.APIPromise<KeyUpdateResponse>;
    /**
     * Gets the Access key rotation settings for an account.
     *
     * @example
     * ```ts
     * const key = await client.zeroTrust.access.keys.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: KeyGetParams, options?: Core.RequestOptions): Core.APIPromise<KeyGetResponse>;
    /**
     * Perfoms a key rotation for an account.
     *
     * @example
     * ```ts
     * const response = await client.zeroTrust.access.keys.rotate({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    rotate(params: KeyRotateParams, options?: Core.RequestOptions): Core.APIPromise<KeyRotateResponse>;
}
export interface KeyUpdateResponse {
    /**
     * The number of days until the next key rotation.
     */
    days_until_next_rotation?: number;
    /**
     * The number of days between key rotations.
     */
    key_rotation_interval_days?: number;
    /**
     * The timestamp of the previous key rotation.
     */
    last_key_rotation_at?: string;
}
export interface KeyGetResponse {
    /**
     * The number of days until the next key rotation.
     */
    days_until_next_rotation?: number;
    /**
     * The number of days between key rotations.
     */
    key_rotation_interval_days?: number;
    /**
     * The timestamp of the previous key rotation.
     */
    last_key_rotation_at?: string;
}
export interface KeyRotateResponse {
    /**
     * The number of days until the next key rotation.
     */
    days_until_next_rotation?: number;
    /**
     * The number of days between key rotations.
     */
    key_rotation_interval_days?: number;
    /**
     * The timestamp of the previous key rotation.
     */
    last_key_rotation_at?: string;
}
export interface KeyUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The number of days between key rotations.
     */
    key_rotation_interval_days: number;
}
export interface KeyGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface KeyRotateParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Keys {
    export { type KeyUpdateResponse as KeyUpdateResponse, type KeyGetResponse as KeyGetResponse, type KeyRotateResponse as KeyRotateResponse, type KeyUpdateParams as KeyUpdateParams, type KeyGetParams as KeyGetParams, type KeyRotateParams as KeyRotateParams, };
}
//# sourceMappingURL=keys.d.ts.map