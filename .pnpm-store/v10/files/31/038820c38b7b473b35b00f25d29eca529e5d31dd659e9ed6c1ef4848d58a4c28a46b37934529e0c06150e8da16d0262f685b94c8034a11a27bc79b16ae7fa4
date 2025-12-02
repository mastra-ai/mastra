// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class ManagedTransforms extends APIResource {
  /**
   * Fetches a list of all Managed Transforms.
   */
  list(
    params: ManagedTransformListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ManagedTransformListResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/managed_headers`, options) as Core.APIPromise<{
        result: ManagedTransformListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Disables all Managed Transforms.
   */
  delete(params: ManagedTransformDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/managed_headers`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Updates the status of one or more Managed Transforms.
   */
  edit(
    params: ManagedTransformEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ManagedTransformEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/managed_headers`, { body, ...options }) as Core.APIPromise<{
        result: ManagedTransformEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * A result.
 */
export interface ManagedTransformListResponse {
  /**
   * The list of Managed Request Transforms.
   */
  managed_request_headers: Array<ManagedTransformListResponse.ManagedRequestHeader>;

  /**
   * The list of Managed Response Transforms.
   */
  managed_response_headers: Array<ManagedTransformListResponse.ManagedResponseHeader>;
}

export namespace ManagedTransformListResponse {
  /**
   * A Managed Transform object.
   */
  export interface ManagedRequestHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;

    /**
     * Whether the Managed Transform conflicts with the currently-enabled Managed
     * Transforms.
     */
    has_conflict: boolean;

    /**
     * The Managed Transforms that this Managed Transform conflicts with.
     */
    conflicts_with?: Array<string>;
  }

  /**
   * A Managed Transform object.
   */
  export interface ManagedResponseHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;

    /**
     * Whether the Managed Transform conflicts with the currently-enabled Managed
     * Transforms.
     */
    has_conflict: boolean;

    /**
     * The Managed Transforms that this Managed Transform conflicts with.
     */
    conflicts_with?: Array<string>;
  }
}

/**
 * A result.
 */
export interface ManagedTransformEditResponse {
  /**
   * The list of Managed Request Transforms.
   */
  managed_request_headers: Array<ManagedTransformEditResponse.ManagedRequestHeader>;

  /**
   * The list of Managed Response Transforms.
   */
  managed_response_headers: Array<ManagedTransformEditResponse.ManagedResponseHeader>;
}

export namespace ManagedTransformEditResponse {
  /**
   * A Managed Transform object.
   */
  export interface ManagedRequestHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;

    /**
     * Whether the Managed Transform conflicts with the currently-enabled Managed
     * Transforms.
     */
    has_conflict: boolean;

    /**
     * The Managed Transforms that this Managed Transform conflicts with.
     */
    conflicts_with?: Array<string>;
  }

  /**
   * A Managed Transform object.
   */
  export interface ManagedResponseHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;

    /**
     * Whether the Managed Transform conflicts with the currently-enabled Managed
     * Transforms.
     */
    has_conflict: boolean;

    /**
     * The Managed Transforms that this Managed Transform conflicts with.
     */
    conflicts_with?: Array<string>;
  }
}

export interface ManagedTransformListParams {
  /**
   * The unique ID of the zone.
   */
  zone_id: string;
}

export interface ManagedTransformDeleteParams {
  /**
   * The unique ID of the zone.
   */
  zone_id: string;
}

export interface ManagedTransformEditParams {
  /**
   * Path param: The unique ID of the zone.
   */
  zone_id: string;

  /**
   * Body param: The list of Managed Request Transforms.
   */
  managed_request_headers: Array<ManagedTransformEditParams.ManagedRequestHeader>;

  /**
   * Body param: The list of Managed Response Transforms.
   */
  managed_response_headers: Array<ManagedTransformEditParams.ManagedResponseHeader>;
}

export namespace ManagedTransformEditParams {
  /**
   * A Managed Transform object.
   */
  export interface ManagedRequestHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;
  }

  /**
   * A Managed Transform object.
   */
  export interface ManagedResponseHeader {
    /**
     * The human-readable identifier of the Managed Transform.
     */
    id: string;

    /**
     * Whether the Managed Transform is enabled.
     */
    enabled: boolean;
  }
}

export declare namespace ManagedTransforms {
  export {
    type ManagedTransformListResponse as ManagedTransformListResponse,
    type ManagedTransformEditResponse as ManagedTransformEditResponse,
    type ManagedTransformListParams as ManagedTransformListParams,
    type ManagedTransformDeleteParams as ManagedTransformDeleteParams,
    type ManagedTransformEditParams as ManagedTransformEditParams,
  };
}
