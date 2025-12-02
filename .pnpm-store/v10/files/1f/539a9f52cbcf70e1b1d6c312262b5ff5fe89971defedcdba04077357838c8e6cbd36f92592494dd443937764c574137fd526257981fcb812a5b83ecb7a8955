import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { CursorLimitPagination, type CursorLimitPaginationParams } from "../../../pagination.js";
export declare class Keys extends APIResource {
    /**
     * Lists a namespace's keys.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const key of client.kv.namespaces.keys.list(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(namespaceId: string, params: KeyListParams, options?: Core.RequestOptions): Core.PagePromise<KeysCursorLimitPagination, Key>;
    /**
     * Remove multiple KV pairs from the namespace. Body should be an array of up to
     * 10,000 keys to be removed.
     *
     * @deprecated Please use kv.namespaces.bulk_delete instead
     */
    bulkDelete(namespaceId: string, params: KeyBulkDeleteParams, options?: Core.RequestOptions): Core.APIPromise<KeyBulkDeleteResponse | null>;
    /**
     * Retrieve up to 100 KV pairs from the namespace. Keys must contain text-based
     * values. JSON values can optionally be parsed instead of being returned as a
     * string value. Metadata can be included if `withMetadata` is true.
     *
     * @deprecated Please use kv.namespaces.bulk_get instead
     */
    bulkGet(namespaceId: string, params: KeyBulkGetParams, options?: Core.RequestOptions): Core.APIPromise<KeyBulkGetResponse | null>;
    /**
     * Write multiple keys and values at once. Body should be an array of up to 10,000
     * key-value pairs to be stored, along with optional expiration information.
     * Existing values and expirations will be overwritten. If neither `expiration` nor
     * `expiration_ttl` is specified, the key-value pair will never expire. If both are
     * set, `expiration_ttl` is used and `expiration` is ignored. The entire request
     * size must be 100 megabytes or less.
     *
     * @deprecated Please use kv.namespaces.bulk_update instead
     */
    bulkUpdate(namespaceId: string, params: KeyBulkUpdateParams, options?: Core.RequestOptions): Core.APIPromise<KeyBulkUpdateResponse | null>;
}
export declare class KeysCursorLimitPagination extends CursorLimitPagination<Key> {
}
/**
 * A name for a value. A value stored under a given key may be retrieved via the
 * same key.
 */
export interface Key {
    /**
     * A key's name. The name may be at most 512 bytes. All printable, non-whitespace
     * characters are valid. Use percent-encoding to define key names as part of a URL.
     */
    name: string;
    /**
     * The time, measured in number of seconds since the UNIX epoch, at which the key
     * will expire. This property is omitted for keys that will not expire.
     */
    expiration?: number;
    metadata?: unknown;
}
export interface KeyBulkDeleteResponse {
    /**
     * Number of keys successfully updated.
     */
    successful_key_count?: number;
    /**
     * Name of the keys that failed to be fully updated. They should be retried.
     */
    unsuccessful_keys?: Array<string>;
}
export type KeyBulkGetResponse = KeyBulkGetResponse.WorkersKVBulkGetResult | KeyBulkGetResponse.WorkersKVBulkGetResultWithMetadata;
export declare namespace KeyBulkGetResponse {
    interface WorkersKVBulkGetResult {
        /**
         * Requested keys are paired with their values in an object.
         */
        values?: {
            [key: string]: string | number | boolean | {
                [key: string]: unknown;
            };
        };
    }
    interface WorkersKVBulkGetResultWithMetadata {
        /**
         * Requested keys are paired with their values and metadata in an object.
         */
        values?: {
            [key: string]: WorkersKVBulkGetResultWithMetadata.Values | null;
        };
    }
    namespace WorkersKVBulkGetResultWithMetadata {
        interface Values {
            metadata: unknown;
            value: unknown;
            /**
             * Expires the key at a certain time, measured in number of seconds since the UNIX
             * epoch.
             */
            expiration?: number;
        }
    }
}
export interface KeyBulkUpdateResponse {
    /**
     * Number of keys successfully updated.
     */
    successful_key_count?: number;
    /**
     * Name of the keys that failed to be fully updated. They should be retried.
     */
    unsuccessful_keys?: Array<string>;
}
export interface KeyListParams extends CursorLimitPaginationParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: Filters returned keys by a name prefix. Exact matches and any key
     * names that begin with the prefix will be returned.
     */
    prefix?: string;
}
export interface KeyBulkDeleteParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<string>;
}
export interface KeyBulkGetParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Array of keys to retrieve (maximum of 100).
     */
    keys: Array<string>;
    /**
     * Body param: Whether to parse JSON values in the response.
     */
    type?: 'text' | 'json';
    /**
     * Body param: Whether to include metadata in the response.
     */
    withMetadata?: boolean;
}
export interface KeyBulkUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<KeyBulkUpdateParams.Body>;
}
export declare namespace KeyBulkUpdateParams {
    interface Body {
        /**
         * A key's name. The name may be at most 512 bytes. All printable, non-whitespace
         * characters are valid.
         */
        key: string;
        /**
         * A UTF-8 encoded string to be stored, up to 25 MiB in length.
         */
        value: string;
        /**
         * Indicates whether or not the server should base64 decode the value before
         * storing it. Useful for writing values that wouldn't otherwise be valid JSON
         * strings, such as images.
         */
        base64?: boolean;
        /**
         * Expires the key at a certain time, measured in number of seconds since the UNIX
         * epoch.
         */
        expiration?: number;
        /**
         * Expires the key after a number of seconds. Must be at least 60.
         */
        expiration_ttl?: number;
        metadata?: unknown;
    }
}
export declare namespace Keys {
    export { type Key as Key, type KeyBulkDeleteResponse as KeyBulkDeleteResponse, type KeyBulkGetResponse as KeyBulkGetResponse, type KeyBulkUpdateResponse as KeyBulkUpdateResponse, KeysCursorLimitPagination as KeysCursorLimitPagination, type KeyListParams as KeyListParams, type KeyBulkDeleteParams as KeyBulkDeleteParams, type KeyBulkGetParams as KeyBulkGetParams, type KeyBulkUpdateParams as KeyBulkUpdateParams, };
}
//# sourceMappingURL=keys.d.ts.map