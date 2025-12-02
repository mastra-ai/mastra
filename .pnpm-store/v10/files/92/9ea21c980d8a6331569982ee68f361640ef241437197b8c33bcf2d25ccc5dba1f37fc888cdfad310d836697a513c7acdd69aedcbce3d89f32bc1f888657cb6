// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Resources extends APIResource {
  /**
   * Create a new share resource
   *
   * @example
   * ```ts
   * const resource =
   *   await client.resourceSharing.resources.create(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       meta: {},
   *       resource_account_id:
   *         '023e105f4ecef8ad9ca31a8372d0c353',
   *       resource_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       resource_type: 'custom-ruleset',
   *     },
   *   );
   * ```
   */
  create(
    shareId: string,
    params: ResourceCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/shares/${shareId}/resources`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ResourceCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update is not immediate, an updated share resource object with a new status will
   * be returned.
   *
   * @example
   * ```ts
   * const resource =
   *   await client.resourceSharing.resources.update(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       meta: {},
   *     },
   *   );
   * ```
   */
  update(
    shareId: string,
    resourceId: string,
    params: ResourceUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ResourceUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List share resources by share ID.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const resourceListResponse of client.resourceSharing.resources.list(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    shareId: string,
    params: ResourceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ResourceListResponsesV4PagePaginationArray, ResourceListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/shares/${shareId}/resources`,
      ResourceListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletion is not immediate, an updated share resource object with a new status
   * will be returned.
   *
   * @example
   * ```ts
   * const resource =
   *   await client.resourceSharing.resources.delete(
   *     '3fd85f74b32742f1bff64a85009dda07',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    shareId: string,
    resourceId: string,
    params: ResourceDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`,
        options,
      ) as Core.APIPromise<{ result: ResourceDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get share resource by ID.
   *
   * @example
   * ```ts
   * const resource = await client.resourceSharing.resources.get(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    shareId: string,
    resourceId: string,
    params: ResourceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/shares/${shareId}/resources/${resourceId}`,
        options,
      ) as Core.APIPromise<{ result: ResourceGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ResourceListResponsesV4PagePaginationArray extends V4PagePaginationArray<ResourceListResponse> {}

export interface ResourceCreateResponse {
  /**
   * Share Resource identifier.
   */
  id: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * Resource Metadata.
   */
  meta: unknown;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Account identifier.
   */
  resource_account_id: string;

  /**
   * Share Resource identifier.
   */
  resource_id: string;

  /**
   * Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';

  /**
   * Resource Version.
   */
  resource_version: number;

  /**
   * Resource Status.
   */
  status: 'active' | 'deleting' | 'deleted';
}

export interface ResourceUpdateResponse {
  /**
   * Share Resource identifier.
   */
  id: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * Resource Metadata.
   */
  meta: unknown;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Account identifier.
   */
  resource_account_id: string;

  /**
   * Share Resource identifier.
   */
  resource_id: string;

  /**
   * Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';

  /**
   * Resource Version.
   */
  resource_version: number;

  /**
   * Resource Status.
   */
  status: 'active' | 'deleting' | 'deleted';
}

export interface ResourceListResponse {
  /**
   * Share Resource identifier.
   */
  id: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * Resource Metadata.
   */
  meta: unknown;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Account identifier.
   */
  resource_account_id: string;

  /**
   * Share Resource identifier.
   */
  resource_id: string;

  /**
   * Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';

  /**
   * Resource Version.
   */
  resource_version: number;

  /**
   * Resource Status.
   */
  status: 'active' | 'deleting' | 'deleted';
}

export interface ResourceDeleteResponse {
  /**
   * Share Resource identifier.
   */
  id: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * Resource Metadata.
   */
  meta: unknown;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Account identifier.
   */
  resource_account_id: string;

  /**
   * Share Resource identifier.
   */
  resource_id: string;

  /**
   * Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';

  /**
   * Resource Version.
   */
  resource_version: number;

  /**
   * Resource Status.
   */
  status: 'active' | 'deleting' | 'deleted';
}

export interface ResourceGetResponse {
  /**
   * Share Resource identifier.
   */
  id: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * Resource Metadata.
   */
  meta: unknown;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * Account identifier.
   */
  resource_account_id: string;

  /**
   * Share Resource identifier.
   */
  resource_id: string;

  /**
   * Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';

  /**
   * Resource Version.
   */
  resource_version: number;

  /**
   * Resource Status.
   */
  status: 'active' | 'deleting' | 'deleted';
}

export interface ResourceCreateParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Body param: Resource Metadata.
   */
  meta: unknown;

  /**
   * Body param: Account identifier.
   */
  resource_account_id: string;

  /**
   * Body param: Share Resource identifier.
   */
  resource_id: string;

  /**
   * Body param: Resource Type.
   */
  resource_type: 'custom-ruleset' | 'widget';
}

export interface ResourceUpdateParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Body param: Resource Metadata.
   */
  meta: unknown;
}

export interface ResourceListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Query param: Filter share resources by resource_type.
   */
  resource_type?: 'custom-ruleset' | 'widget';

  /**
   * Query param: Filter share resources by status.
   */
  status?: 'active' | 'deleting' | 'deleted';
}

export interface ResourceDeleteParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

export interface ResourceGetParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

Resources.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;

export declare namespace Resources {
  export {
    type ResourceCreateResponse as ResourceCreateResponse,
    type ResourceUpdateResponse as ResourceUpdateResponse,
    type ResourceListResponse as ResourceListResponse,
    type ResourceDeleteResponse as ResourceDeleteResponse,
    type ResourceGetResponse as ResourceGetResponse,
    ResourceListResponsesV4PagePaginationArray as ResourceListResponsesV4PagePaginationArray,
    type ResourceCreateParams as ResourceCreateParams,
    type ResourceUpdateParams as ResourceUpdateParams,
    type ResourceListParams as ResourceListParams,
    type ResourceDeleteParams as ResourceDeleteParams,
    type ResourceGetParams as ResourceGetParams,
  };
}
