// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Managed extends APIResource {
  /**
   * Updates state of public access over the bucket's R2-managed (r2.dev) domain.
   *
   * @example
   * ```ts
   * const managed =
   *   await client.r2.buckets.domains.managed.update(
   *     'example-bucket',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       enabled: true,
   *     },
   *   );
   * ```
   */
  update(
    bucketName: string,
    params: ManagedUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ManagedUpdateResponse> {
    const { account_id, jurisdiction, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/managed`, {
        body,
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: ManagedUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets state of public access over the bucket's R2-managed (r2.dev) domain.
   *
   * @example
   * ```ts
   * const manageds =
   *   await client.r2.buckets.domains.managed.list(
   *     'example-bucket',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  list(
    bucketName: string,
    params: ManagedListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ManagedListResponse> {
    const { account_id, jurisdiction } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/managed`, {
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: ManagedListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ManagedUpdateResponse {
  /**
   * Bucket ID.
   */
  bucketId: string;

  /**
   * Domain name of the bucket's r2.dev domain.
   */
  domain: string;

  /**
   * Whether this bucket is publicly accessible at the r2.dev domain.
   */
  enabled: boolean;
}

export interface ManagedListResponse {
  /**
   * Bucket ID.
   */
  bucketId: string;

  /**
   * Domain name of the bucket's r2.dev domain.
   */
  domain: string;

  /**
   * Whether this bucket is publicly accessible at the r2.dev domain.
   */
  enabled: boolean;
}

export interface ManagedUpdateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param: Whether to enable public bucket access at the r2.dev domain.
   */
  enabled: boolean;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export interface ManagedListParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export declare namespace Managed {
  export {
    type ManagedUpdateResponse as ManagedUpdateResponse,
    type ManagedListResponse as ManagedListResponse,
    type ManagedUpdateParams as ManagedUpdateParams,
    type ManagedListParams as ManagedListParams,
  };
}
