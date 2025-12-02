import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import { SinglePage } from "../../../../../pagination.js";
export declare class Secrets extends APIResource {
    /**
     * Add a secret to a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const secret =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.secrets.update(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       name: 'myBinding',
     *       text: 'My secret.',
     *       type: 'secret_text',
     *     },
     *   );
     * ```
     */
    update(dispatchNamespace: string, scriptName: string, params: SecretUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SecretUpdateResponse>;
    /**
     * List secrets bound to a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const secretListResponse of client.workersForPlatforms.dispatch.namespaces.scripts.secrets.list(
     *   'my-dispatch-namespace',
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(dispatchNamespace: string, scriptName: string, params: SecretListParams, options?: Core.RequestOptions): Core.PagePromise<SecretListResponsesSinglePage, SecretListResponse>;
    /**
     * Remove a secret from a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const secret =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.secrets.delete(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     'mySecret',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(dispatchNamespace: string, scriptName: string, secretName: string, params: SecretDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SecretDeleteResponse | null>;
    /**
     * Get a given secret binding (value omitted) on a script uploaded to a Workers for
     * Platforms namespace.
     *
     * @example
     * ```ts
     * const secret =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.secrets.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     'mySecret',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace: string, scriptName: string, secretName: string, params: SecretGetParams, options?: Core.RequestOptions): Core.APIPromise<SecretGetResponse>;
}
export declare class SecretListResponsesSinglePage extends SinglePage<SecretListResponse> {
}
/**
 * A secret value accessible through a binding.
 */
export type SecretUpdateResponse = SecretUpdateResponse.WorkersBindingKindSecretText | SecretUpdateResponse.WorkersBindingKindSecretKey;
export declare namespace SecretUpdateResponse {
    interface WorkersBindingKindSecretText {
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_text';
    }
    interface WorkersBindingKindSecretKey {
        /**
         * Algorithm-specific key parameters.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#algorithm).
         */
        algorithm: unknown;
        /**
         * Data format of the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#format).
         */
        format: 'raw' | 'pkcs8' | 'spki' | 'jwk';
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_key';
        /**
         * Allowed operations with the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#keyUsages).
         */
        usages: Array<'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'>;
    }
}
/**
 * A secret value accessible through a binding.
 */
export type SecretListResponse = SecretListResponse.WorkersBindingKindSecretText | SecretListResponse.WorkersBindingKindSecretKey;
export declare namespace SecretListResponse {
    interface WorkersBindingKindSecretText {
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_text';
    }
    interface WorkersBindingKindSecretKey {
        /**
         * Algorithm-specific key parameters.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#algorithm).
         */
        algorithm: unknown;
        /**
         * Data format of the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#format).
         */
        format: 'raw' | 'pkcs8' | 'spki' | 'jwk';
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_key';
        /**
         * Allowed operations with the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#keyUsages).
         */
        usages: Array<'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'>;
    }
}
export type SecretDeleteResponse = unknown;
/**
 * A secret value accessible through a binding.
 */
export type SecretGetResponse = SecretGetResponse.WorkersBindingKindSecretText | SecretGetResponse.WorkersBindingKindSecretKey;
export declare namespace SecretGetResponse {
    interface WorkersBindingKindSecretText {
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_text';
    }
    interface WorkersBindingKindSecretKey {
        /**
         * Algorithm-specific key parameters.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#algorithm).
         */
        algorithm: unknown;
        /**
         * Data format of the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#format).
         */
        format: 'raw' | 'pkcs8' | 'spki' | 'jwk';
        /**
         * A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * The kind of resource that the binding provides.
         */
        type: 'secret_key';
        /**
         * Allowed operations with the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#keyUsages).
         */
        usages: Array<'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'>;
    }
}
export type SecretUpdateParams = SecretUpdateParams.WorkersBindingKindSecretText | SecretUpdateParams.WorkersBindingKindSecretKey;
export declare namespace SecretUpdateParams {
    interface WorkersBindingKindSecretText {
        /**
         * Path param: Identifier.
         */
        account_id: string;
        /**
         * Body param: A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * Body param: The secret value to use.
         */
        text: string;
        /**
         * Body param: The kind of resource that the binding provides.
         */
        type: 'secret_text';
    }
    interface WorkersBindingKindSecretKey {
        /**
         * Path param: Identifier.
         */
        account_id: string;
        /**
         * Body param: Algorithm-specific key parameters.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#algorithm).
         */
        algorithm: unknown;
        /**
         * Body param: Data format of the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#format).
         */
        format: 'raw' | 'pkcs8' | 'spki' | 'jwk';
        /**
         * Body param: A JavaScript variable name for the binding.
         */
        name: string;
        /**
         * Body param: The kind of resource that the binding provides.
         */
        type: 'secret_key';
        /**
         * Body param: Allowed operations with the key.
         * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#keyUsages).
         */
        usages: Array<'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'>;
        /**
         * Body param: Base64-encoded key data. Required if `format` is "raw", "pkcs8", or
         * "spki".
         */
        key_base64?: string;
        /**
         * Body param: Key data in
         * [JSON Web Key](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#json_web_key)
         * format. Required if `format` is "jwk".
         */
        key_jwk?: unknown;
    }
}
export interface SecretListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface SecretDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface SecretGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Secrets {
    export { type SecretUpdateResponse as SecretUpdateResponse, type SecretListResponse as SecretListResponse, type SecretDeleteResponse as SecretDeleteResponse, type SecretGetResponse as SecretGetResponse, SecretListResponsesSinglePage as SecretListResponsesSinglePage, type SecretUpdateParams as SecretUpdateParams, type SecretListParams as SecretListParams, type SecretDeleteParams as SecretDeleteParams, type SecretGetParams as SecretGetParams, };
}
//# sourceMappingURL=secrets.d.ts.map