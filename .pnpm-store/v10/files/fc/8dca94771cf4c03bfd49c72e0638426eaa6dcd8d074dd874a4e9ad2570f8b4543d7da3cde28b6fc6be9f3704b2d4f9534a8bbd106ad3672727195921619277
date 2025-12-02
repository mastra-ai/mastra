// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class ImpersonationRegistry extends APIResource {
  /**
   * Create an entry in impersonation registry
   *
   * @example
   * ```ts
   * const impersonationRegistry =
   *   await client.emailSecurity.settings.impersonationRegistry.create(
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       email: 'email',
   *       is_email_regex: true,
   *       name: 'name',
   *     },
   *   );
   * ```
   */
  create(
    params: ImpersonationRegistryCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ImpersonationRegistryCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/email-security/settings/impersonation_registry`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ImpersonationRegistryCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists, searches, and sorts entries in the impersonation registry.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const impersonationRegistryListResponse of client.emailSecurity.settings.impersonationRegistry.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: ImpersonationRegistryListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<
    ImpersonationRegistryListResponsesV4PagePaginationArray,
    ImpersonationRegistryListResponse
  > {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/settings/impersonation_registry`,
      ImpersonationRegistryListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete an entry from impersonation registry
   *
   * @example
   * ```ts
   * const impersonationRegistry =
   *   await client.emailSecurity.settings.impersonationRegistry.delete(
   *     2403,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    displayNameId: number,
    params: ImpersonationRegistryDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ImpersonationRegistryDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`,
        options,
      ) as Core.APIPromise<{ result: ImpersonationRegistryDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update an entry in impersonation registry
   *
   * @example
   * ```ts
   * const response =
   *   await client.emailSecurity.settings.impersonationRegistry.edit(
   *     2403,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  edit(
    displayNameId: number,
    params: ImpersonationRegistryEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ImpersonationRegistryEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(
        `/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`,
        { body, ...options },
      ) as Core.APIPromise<{ result: ImpersonationRegistryEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get an entry in impersonation registry
   *
   * @example
   * ```ts
   * const impersonationRegistry =
   *   await client.emailSecurity.settings.impersonationRegistry.get(
   *     2403,
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    displayNameId: number,
    params: ImpersonationRegistryGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ImpersonationRegistryGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/email-security/settings/impersonation_registry/${displayNameId}`,
        options,
      ) as Core.APIPromise<{ result: ImpersonationRegistryGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ImpersonationRegistryListResponsesV4PagePaginationArray extends V4PagePaginationArray<ImpersonationRegistryListResponse> {}

export interface ImpersonationRegistryCreateResponse {
  id: number;

  created_at: string;

  email: string;

  is_email_regex: boolean;

  last_modified: string;

  name: string;

  comments?: string | null;

  directory_id?: number | null;

  directory_node_id?: number | null;

  /**
   * @deprecated
   */
  external_directory_node_id?: string | null;

  provenance?: string | null;
}

export interface ImpersonationRegistryListResponse {
  id: number;

  created_at: string;

  email: string;

  is_email_regex: boolean;

  last_modified: string;

  name: string;

  comments?: string | null;

  directory_id?: number | null;

  directory_node_id?: number | null;

  /**
   * @deprecated
   */
  external_directory_node_id?: string | null;

  provenance?: string | null;
}

export interface ImpersonationRegistryDeleteResponse {
  id: number;
}

export interface ImpersonationRegistryEditResponse {
  id: number;

  created_at: string;

  email: string;

  is_email_regex: boolean;

  last_modified: string;

  name: string;

  comments?: string | null;

  directory_id?: number | null;

  directory_node_id?: number | null;

  /**
   * @deprecated
   */
  external_directory_node_id?: string | null;

  provenance?: string | null;
}

export interface ImpersonationRegistryGetResponse {
  id: number;

  created_at: string;

  email: string;

  is_email_regex: boolean;

  last_modified: string;

  name: string;

  comments?: string | null;

  directory_id?: number | null;

  directory_node_id?: number | null;

  /**
   * @deprecated
   */
  external_directory_node_id?: string | null;

  provenance?: string | null;
}

export interface ImpersonationRegistryCreateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  email: string;

  /**
   * Body param:
   */
  is_email_regex: boolean;

  /**
   * Body param:
   */
  name: string;
}

export interface ImpersonationRegistryListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Query param: The sorting direction.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: The field to sort by.
   */
  order?: 'name' | 'email' | 'created_at';

  /**
   * Query param:
   */
  provenance?: 'A1S_INTERNAL' | 'SNOOPY-CASB_OFFICE_365' | 'SNOOPY-OFFICE_365' | 'SNOOPY-GOOGLE_DIRECTORY';

  /**
   * Query param: Allows searching in multiple properties of a record simultaneously.
   * This parameter is intended for human users, not automation. Its exact behavior
   * is intentionally left unspecified and is subject to change in the future.
   */
  search?: string;
}

export interface ImpersonationRegistryDeleteParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export interface ImpersonationRegistryEditParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  email?: string | null;

  /**
   * Body param:
   */
  is_email_regex?: boolean | null;

  /**
   * Body param:
   */
  name?: string | null;
}

export interface ImpersonationRegistryGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

ImpersonationRegistry.ImpersonationRegistryListResponsesV4PagePaginationArray =
  ImpersonationRegistryListResponsesV4PagePaginationArray;

export declare namespace ImpersonationRegistry {
  export {
    type ImpersonationRegistryCreateResponse as ImpersonationRegistryCreateResponse,
    type ImpersonationRegistryListResponse as ImpersonationRegistryListResponse,
    type ImpersonationRegistryDeleteResponse as ImpersonationRegistryDeleteResponse,
    type ImpersonationRegistryEditResponse as ImpersonationRegistryEditResponse,
    type ImpersonationRegistryGetResponse as ImpersonationRegistryGetResponse,
    ImpersonationRegistryListResponsesV4PagePaginationArray as ImpersonationRegistryListResponsesV4PagePaginationArray,
    type ImpersonationRegistryCreateParams as ImpersonationRegistryCreateParams,
    type ImpersonationRegistryListParams as ImpersonationRegistryListParams,
    type ImpersonationRegistryDeleteParams as ImpersonationRegistryDeleteParams,
    type ImpersonationRegistryEditParams as ImpersonationRegistryEditParams,
    type ImpersonationRegistryGetParams as ImpersonationRegistryGetParams,
  };
}
