// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { CursorPagination, type CursorPaginationParams } from '../../../pagination';

export class Registrations extends APIResource {
  /**
   * Lists WARP registrations.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const registrationListResponse of client.zeroTrust.devices.registrations.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RegistrationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RegistrationListResponsesCursorPagination, RegistrationListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/registrations`,
      RegistrationListResponsesCursorPagination,
      { query, ...options },
    );
  }

  /**
   * Deletes a WARP registration.
   *
   * @example
   * ```ts
   * const registration =
   *   await client.zeroTrust.devices.registrations.delete(
   *     'registration_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    registrationId: string,
    params: RegistrationDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegistrationDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/devices/registrations/${registrationId}`,
        options,
      ) as Core.APIPromise<{ result: RegistrationDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a list of WARP registrations.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.devices.registrations.bulkDelete({
   *     account_id: 'account_id',
   *     id: ['string'],
   *   });
   * ```
   */
  bulkDelete(
    params: RegistrationBulkDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegistrationBulkDeleteResponse | null> {
    const { account_id, id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/devices/registrations`, {
        query: { id },
        ...options,
      }) as Core.APIPromise<{ result: RegistrationBulkDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single WARP registration.
   *
   * @example
   * ```ts
   * const registration =
   *   await client.zeroTrust.devices.registrations.get(
   *     'registration_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    registrationId: string,
    params: RegistrationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegistrationGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/devices/registrations/${registrationId}`,
        options,
      ) as Core.APIPromise<{ result: RegistrationGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Revokes a list of WARP registrations.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.devices.registrations.revoke({
   *     account_id: 'account_id',
   *     id: ['string'],
   *   });
   * ```
   */
  revoke(
    params: RegistrationRevokeParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegistrationRevokeResponse | null> {
    const { account_id, id } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/registrations/revoke`, {
        query: { id },
        ...options,
      }) as Core.APIPromise<{ result: RegistrationRevokeResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Unrevokes a list of WARP registrations.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.devices.registrations.unrevoke({
   *     account_id: 'account_id',
   *     id: ['string'],
   *   });
   * ```
   */
  unrevoke(
    params: RegistrationUnrevokeParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RegistrationUnrevokeResponse | null> {
    const { account_id, id } = params;
    return (
      this._client.post(`/accounts/${account_id}/devices/registrations/unrevoke`, {
        query: { id },
        ...options,
      }) as Core.APIPromise<{ result: RegistrationUnrevokeResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RegistrationListResponsesCursorPagination extends CursorPagination<RegistrationListResponse> {}

/**
 * A WARP configuration tied to a single user. Multiple registrations can be
 * created from a single WARP device.
 */
export interface RegistrationListResponse {
  /**
   * The ID of the registration.
   */
  id: string;

  /**
   * The RFC3339 timestamp when the registration was created.
   */
  created_at: string;

  /**
   * Device details embedded inside of a registration.
   */
  device: RegistrationListResponse.Device;

  /**
   * The public key used to connect to the Cloudflare network.
   */
  key: string;

  /**
   * The RFC3339 timestamp when the registration was last seen.
   */
  last_seen_at: string;

  /**
   * The RFC3339 timestamp when the registration was last updated.
   */
  updated_at: string;

  /**
   * The RFC3339 timestamp when the registration was deleted.
   */
  deleted_at?: string | null;

  /**
   * The type of encryption key used by the WARP client for the active key. Currently
   * 'curve25519' for WireGuard and 'secp256r1' for MASQUE.
   */
  key_type?: string | null;

  /**
   * The RFC3339 timestamp when the registration was revoked.
   */
  revoked_at?: string | null;

  /**
   * Type of the tunnel - wireguard or masque.
   */
  tunnel_type?: string | null;

  user?: RegistrationListResponse.User;
}

export namespace RegistrationListResponse {
  /**
   * Device details embedded inside of a registration.
   */
  export interface Device {
    /**
     * The ID of the device.
     */
    id: string;

    /**
     * The name of the device.
     */
    name: string;

    /**
     * Version of the WARP client.
     */
    client_version?: string;
  }

  export interface User {
    /**
     * UUID.
     */
    id?: string;

    /**
     * The contact email address of the user.
     */
    email?: string;

    /**
     * The enrolled device user's name.
     */
    name?: string;
  }
}

export type RegistrationDeleteResponse = unknown;

export type RegistrationBulkDeleteResponse = unknown;

/**
 * A WARP configuration tied to a single user. Multiple registrations can be
 * created from a single WARP device.
 */
export interface RegistrationGetResponse {
  /**
   * The ID of the registration.
   */
  id: string;

  /**
   * The RFC3339 timestamp when the registration was created.
   */
  created_at: string;

  /**
   * Device details embedded inside of a registration.
   */
  device: RegistrationGetResponse.Device;

  /**
   * The public key used to connect to the Cloudflare network.
   */
  key: string;

  /**
   * The RFC3339 timestamp when the registration was last seen.
   */
  last_seen_at: string;

  /**
   * The RFC3339 timestamp when the registration was last updated.
   */
  updated_at: string;

  /**
   * The RFC3339 timestamp when the registration was deleted.
   */
  deleted_at?: string | null;

  /**
   * The type of encryption key used by the WARP client for the active key. Currently
   * 'curve25519' for WireGuard and 'secp256r1' for MASQUE.
   */
  key_type?: string | null;

  /**
   * The RFC3339 timestamp when the registration was revoked.
   */
  revoked_at?: string | null;

  /**
   * Type of the tunnel - wireguard or masque.
   */
  tunnel_type?: string | null;

  user?: RegistrationGetResponse.User;
}

export namespace RegistrationGetResponse {
  /**
   * Device details embedded inside of a registration.
   */
  export interface Device {
    /**
     * The ID of the device.
     */
    id: string;

    /**
     * The name of the device.
     */
    name: string;

    /**
     * Version of the WARP client.
     */
    client_version?: string;
  }

  export interface User {
    /**
     * UUID.
     */
    id?: string;

    /**
     * The contact email address of the user.
     */
    email?: string;

    /**
     * The enrolled device user's name.
     */
    name?: string;
  }
}

export type RegistrationRevokeResponse = unknown;

export type RegistrationUnrevokeResponse = unknown;

export interface RegistrationListParams extends CursorPaginationParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Filter by registration ID.
   */
  id?: Array<string>;

  /**
   * Query param:
   */
  device?: RegistrationListParams.Device;

  /**
   * Query param:
   */
  include?: string;

  /**
   * Query param: Filter by registration details.
   */
  search?: string;

  /**
   * Query param: Filter by the last_seen timestamp - returns only registrations last
   * seen after this timestamp.
   */
  seen_after?: string;

  /**
   * Query param: Filter by the last_seen timestamp - returns only registrations last
   * seen before this timestamp.
   */
  seen_before?: string;

  /**
   * Query param: The registration field to order results by.
   */
  sort_by?: 'id' | 'user.name' | 'user.email' | 'last_seen_at' | 'created_at';

  /**
   * Query param: Sort direction.
   */
  sort_order?: 'asc' | 'desc';

  /**
   * Query param: Filter by registration status. Defaults to 'active'.
   */
  status?: 'active' | 'all' | 'revoked';

  /**
   * Query param:
   */
  user?: RegistrationListParams.User;
}

export namespace RegistrationListParams {
  export interface Device {
    /**
     * Filter by WARP device ID.
     */
    id?: string;
  }

  export interface User {
    /**
     * Filter by user ID.
     */
    id?: Array<string>;
  }
}

export interface RegistrationDeleteParams {
  account_id: string;
}

export interface RegistrationBulkDeleteParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: A list of registration IDs to delete.
   */
  id: Array<string>;
}

export interface RegistrationGetParams {
  account_id: string;
}

export interface RegistrationRevokeParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: A list of registration IDs to revoke.
   */
  id: Array<string>;
}

export interface RegistrationUnrevokeParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: A list of registration IDs to unrevoke.
   */
  id: Array<string>;
}

Registrations.RegistrationListResponsesCursorPagination = RegistrationListResponsesCursorPagination;

export declare namespace Registrations {
  export {
    type RegistrationListResponse as RegistrationListResponse,
    type RegistrationDeleteResponse as RegistrationDeleteResponse,
    type RegistrationBulkDeleteResponse as RegistrationBulkDeleteResponse,
    type RegistrationGetResponse as RegistrationGetResponse,
    type RegistrationRevokeResponse as RegistrationRevokeResponse,
    type RegistrationUnrevokeResponse as RegistrationUnrevokeResponse,
    RegistrationListResponsesCursorPagination as RegistrationListResponsesCursorPagination,
    type RegistrationListParams as RegistrationListParams,
    type RegistrationDeleteParams as RegistrationDeleteParams,
    type RegistrationBulkDeleteParams as RegistrationBulkDeleteParams,
    type RegistrationGetParams as RegistrationGetParams,
    type RegistrationRevokeParams as RegistrationRevokeParams,
    type RegistrationUnrevokeParams as RegistrationUnrevokeParams,
  };
}
