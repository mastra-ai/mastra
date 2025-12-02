// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Secrets extends APIResource {
  /**
   * Add a secret to a script.
   *
   * @example
   * ```ts
   * const secret = await client.workers.scripts.secrets.update(
   *   'this-is_my_script-01',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     name: 'myBinding',
   *     text: 'My secret.',
   *     type: 'secret_text',
   *   },
   * );
   * ```
   */
  update(
    scriptName: string,
    params: SecretUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/workers/scripts/${scriptName}/secrets`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: SecretUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List secrets bound to a script.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const secretListResponse of client.workers.scripts.secrets.list(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    scriptName: string,
    params: SecretListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<SecretListResponsesSinglePage, SecretListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/scripts/${scriptName}/secrets`,
      SecretListResponsesSinglePage,
      options,
    );
  }

  /**
   * Remove a secret from a script.
   *
   * @example
   * ```ts
   * const secret = await client.workers.scripts.secrets.delete(
   *   'this-is_my_script-01',
   *   'mySecret',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    scriptName: string,
    secretName: string,
    params: SecretDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/workers/scripts/${scriptName}/secrets/${secretName}`,
        options,
      ) as Core.APIPromise<{ result: SecretDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a given secret binding (value omitted) on a script.
   *
   * @example
   * ```ts
   * const secret = await client.workers.scripts.secrets.get(
   *   'this-is_my_script-01',
   *   'mySecret',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    scriptName: string,
    secretName: string,
    params: SecretGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SecretGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/secrets/${secretName}`,
        options,
      ) as Core.APIPromise<{ result: SecretGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class SecretListResponsesSinglePage extends SinglePage<SecretListResponse> {}

/**
 * A secret value accessible through a binding.
 */
export type SecretUpdateResponse =
  | SecretUpdateResponse.WorkersBindingKindSecretText
  | SecretUpdateResponse.WorkersBindingKindSecretKey;

export namespace SecretUpdateResponse {
  export interface WorkersBindingKindSecretText {
    /**
     * A JavaScript variable name for the binding.
     */
    name: string;

    /**
     * The kind of resource that the binding provides.
     */
    type: 'secret_text';
  }

  export interface WorkersBindingKindSecretKey {
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
    usages: Array<
      'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'
    >;
  }
}

/**
 * A secret value accessible through a binding.
 */
export type SecretListResponse =
  | SecretListResponse.WorkersBindingKindSecretText
  | SecretListResponse.WorkersBindingKindSecretKey;

export namespace SecretListResponse {
  export interface WorkersBindingKindSecretText {
    /**
     * A JavaScript variable name for the binding.
     */
    name: string;

    /**
     * The kind of resource that the binding provides.
     */
    type: 'secret_text';
  }

  export interface WorkersBindingKindSecretKey {
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
    usages: Array<
      'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'
    >;
  }
}

export type SecretDeleteResponse = unknown;

/**
 * A secret value accessible through a binding.
 */
export type SecretGetResponse =
  | SecretGetResponse.WorkersBindingKindSecretText
  | SecretGetResponse.WorkersBindingKindSecretKey;

export namespace SecretGetResponse {
  export interface WorkersBindingKindSecretText {
    /**
     * A JavaScript variable name for the binding.
     */
    name: string;

    /**
     * The kind of resource that the binding provides.
     */
    type: 'secret_text';
  }

  export interface WorkersBindingKindSecretKey {
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
    usages: Array<
      'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'
    >;
  }
}

export type SecretUpdateParams =
  | SecretUpdateParams.WorkersBindingKindSecretText
  | SecretUpdateParams.WorkersBindingKindSecretKey;

export declare namespace SecretUpdateParams {
  export interface WorkersBindingKindSecretText {
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

  export interface WorkersBindingKindSecretKey {
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
    usages: Array<
      'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'
    >;

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

Secrets.SecretListResponsesSinglePage = SecretListResponsesSinglePage;

export declare namespace Secrets {
  export {
    type SecretUpdateResponse as SecretUpdateResponse,
    type SecretListResponse as SecretListResponse,
    type SecretDeleteResponse as SecretDeleteResponse,
    type SecretGetResponse as SecretGetResponse,
    SecretListResponsesSinglePage as SecretListResponsesSinglePage,
    type SecretUpdateParams as SecretUpdateParams,
    type SecretListParams as SecretListParams,
    type SecretDeleteParams as SecretDeleteParams,
    type SecretGetParams as SecretGetParams,
  };
}
