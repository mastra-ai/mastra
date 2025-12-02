// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { CursorPagination, type CursorPaginationParams } from '../../../pagination';

export class Devices extends APIResource {
  /**
   * Lists WARP devices.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const deviceListResponse of client.zeroTrust.devices.devices.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DeviceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DeviceListResponsesCursorPagination, DeviceListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/devices/physical-devices`,
      DeviceListResponsesCursorPagination,
      { query, ...options },
    );
  }

  /**
   * Deletes a WARP device.
   *
   * @example
   * ```ts
   * const device =
   *   await client.zeroTrust.devices.devices.delete(
   *     'device_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    deviceId: string,
    params: DeviceDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeviceDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/devices/physical-devices/${deviceId}`,
        options,
      ) as Core.APIPromise<{ result: DeviceDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single WARP device.
   *
   * @example
   * ```ts
   * const device = await client.zeroTrust.devices.devices.get(
   *   'device_id',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    deviceId: string,
    params: DeviceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeviceGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/devices/physical-devices/${deviceId}`,
        options,
      ) as Core.APIPromise<{ result: DeviceGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Revokes all WARP registrations associated with the specified device.
   *
   * @example
   * ```ts
   * const response =
   *   await client.zeroTrust.devices.devices.revoke(
   *     'device_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  revoke(
    deviceId: string,
    params: DeviceRevokeParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeviceRevokeResponse | null> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/devices/physical-devices/${deviceId}/revoke`,
        options,
      ) as Core.APIPromise<{ result: DeviceRevokeResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DeviceListResponsesCursorPagination extends CursorPagination<DeviceListResponse> {}

/**
 * A WARP Device.
 */
export interface DeviceListResponse {
  /**
   * The unique ID of the device.
   */
  id: string;

  /**
   * The number of active registrations for the device. Active registrations are
   * those which haven't been revoked or deleted.
   */
  active_registrations: number;

  /**
   * The RFC3339 timestamp when the device was created.
   */
  created_at: string;

  /**
   * The RFC3339 timestamp when the device was last seen.
   */
  last_seen_at: string | null;

  /**
   * The name of the device.
   */
  name: string;

  /**
   * The RFC3339 timestamp when the device was last updated.
   */
  updated_at: string;

  /**
   * Version of the WARP client.
   */
  client_version?: string | null;

  /**
   * The RFC3339 timestamp when the device was deleted.
   */
  deleted_at?: string | null;

  /**
   * The device operating system.
   */
  device_type?: string | null;

  /**
   * A string that uniquely identifies the hardware or virtual machine (VM).
   */
  hardware_id?: string | null;

  /**
   * The last user to use the WARP device.
   */
  last_seen_user?: DeviceListResponse.LastSeenUser | null;

  /**
   * The device MAC address.
   */
  mac_address?: string | null;

  /**
   * The device manufacturer.
   */
  manufacturer?: string | null;

  /**
   * The model name of the device.
   */
  model?: string | null;

  /**
   * The device operating system version number.
   */
  os_version?: string | null;

  /**
   * Additional operating system version data. For macOS or iOS, the Product Version
   * Extra. For Linux, the kernel release version.
   */
  os_version_extra?: string | null;

  /**
   * The public IP address of the WARP client.
   */
  public_ip?: string | null;

  /**
   * The device serial number.
   */
  serial_number?: string | null;
}

export namespace DeviceListResponse {
  /**
   * The last user to use the WARP device.
   */
  export interface LastSeenUser {
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

export type DeviceDeleteResponse = unknown;

/**
 * A WARP Device.
 */
export interface DeviceGetResponse {
  /**
   * The unique ID of the device.
   */
  id: string;

  /**
   * The number of active registrations for the device. Active registrations are
   * those which haven't been revoked or deleted.
   */
  active_registrations: number;

  /**
   * The RFC3339 timestamp when the device was created.
   */
  created_at: string;

  /**
   * The RFC3339 timestamp when the device was last seen.
   */
  last_seen_at: string | null;

  /**
   * The name of the device.
   */
  name: string;

  /**
   * The RFC3339 timestamp when the device was last updated.
   */
  updated_at: string;

  /**
   * Version of the WARP client.
   */
  client_version?: string | null;

  /**
   * The RFC3339 timestamp when the device was deleted.
   */
  deleted_at?: string | null;

  /**
   * The device operating system.
   */
  device_type?: string | null;

  /**
   * A string that uniquely identifies the hardware or virtual machine (VM).
   */
  hardware_id?: string | null;

  /**
   * The last user to use the WARP device.
   */
  last_seen_user?: DeviceGetResponse.LastSeenUser | null;

  /**
   * The device MAC address.
   */
  mac_address?: string | null;

  /**
   * The device manufacturer.
   */
  manufacturer?: string | null;

  /**
   * The model name of the device.
   */
  model?: string | null;

  /**
   * The device operating system version number.
   */
  os_version?: string | null;

  /**
   * Additional operating system version data. For macOS or iOS, the Product Version
   * Extra. For Linux, the kernel release version.
   */
  os_version_extra?: string | null;

  /**
   * The public IP address of the WARP client.
   */
  public_ip?: string | null;

  /**
   * The device serial number.
   */
  serial_number?: string | null;
}

export namespace DeviceGetResponse {
  /**
   * The last user to use the WARP device.
   */
  export interface LastSeenUser {
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

export type DeviceRevokeResponse = unknown;

export interface DeviceListParams extends CursorPaginationParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Filter by a one or more device IDs.
   */
  id?: Array<string>;

  /**
   * Query param: Include or exclude devices with active registrations. The default
   * is "only" - return only devices with active registrations.
   */
  active_registrations?: 'include' | 'only' | 'exclude';

  /**
   * Query param:
   */
  include?: string;

  /**
   * Query param:
   */
  last_seen_user?: DeviceListParams.LastSeenUser;

  /**
   * Query param: Search by device details.
   */
  search?: string;

  /**
   * Query param: Filter by the last_seen timestamp - returns only devices last seen
   * after this timestamp.
   */
  seen_after?: string;

  /**
   * Query param: Filter by the last_seen timestamp - returns only devices last seen
   * before this timestamp.
   */
  seen_before?: string;

  /**
   * Query param: The device field to order results by.
   */
  sort_by?:
    | 'name'
    | 'id'
    | 'client_version'
    | 'last_seen_user.email'
    | 'last_seen_at'
    | 'active_registrations'
    | 'created_at';

  /**
   * Query param: Sort direction.
   */
  sort_order?: 'asc' | 'desc';
}

export namespace DeviceListParams {
  export interface LastSeenUser {
    /**
     * Filter by the last seen user's email.
     */
    email?: string;
  }
}

export interface DeviceDeleteParams {
  account_id: string;
}

export interface DeviceGetParams {
  account_id: string;
}

export interface DeviceRevokeParams {
  account_id: string;
}

Devices.DeviceListResponsesCursorPagination = DeviceListResponsesCursorPagination;

export declare namespace Devices {
  export {
    type DeviceListResponse as DeviceListResponse,
    type DeviceDeleteResponse as DeviceDeleteResponse,
    type DeviceGetResponse as DeviceGetResponse,
    type DeviceRevokeResponse as DeviceRevokeResponse,
    DeviceListResponsesCursorPagination as DeviceListResponsesCursorPagination,
    type DeviceListParams as DeviceListParams,
    type DeviceDeleteParams as DeviceDeleteParams,
    type DeviceGetParams as DeviceGetParams,
    type DeviceRevokeParams as DeviceRevokeParams,
  };
}
