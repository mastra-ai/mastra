// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as RecipientsAPI from './recipients';
import {
  RecipientCreateParams,
  RecipientCreateResponse,
  RecipientDeleteParams,
  RecipientDeleteResponse,
  RecipientGetParams,
  RecipientGetResponse,
  RecipientListParams,
  RecipientListResponse,
  RecipientListResponsesV4PagePaginationArray,
  Recipients,
} from './recipients';
import * as ResourcesAPI from './resources';
import {
  ResourceCreateParams,
  ResourceCreateResponse,
  ResourceDeleteParams,
  ResourceDeleteResponse,
  ResourceGetParams,
  ResourceGetResponse,
  ResourceListParams,
  ResourceListResponse,
  ResourceListResponsesV4PagePaginationArray,
  ResourceUpdateParams,
  ResourceUpdateResponse,
  Resources,
} from './resources';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class ResourceSharing extends APIResource {
  recipients: RecipientsAPI.Recipients = new RecipientsAPI.Recipients(this._client);
  resources: ResourcesAPI.Resources = new ResourcesAPI.Resources(this._client);

  /**
   * Create a new share
   *
   * @example
   * ```ts
   * const resourceSharing = await client.resourceSharing.create(
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     name: 'My Shared WAF Managed Rule',
   *     recipients: [{}],
   *     resources: [
   *       {
   *         meta: {},
   *         resource_account_id:
   *           '023e105f4ecef8ad9ca31a8372d0c353',
   *         resource_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *         resource_type: 'custom-ruleset',
   *       },
   *     ],
   *   },
   * );
   * ```
   */
  create(
    params: ResourceSharingCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceSharingCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/shares`, { body, ...options }) as Core.APIPromise<{
        result: ResourceSharingCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updating is not immediate, an updated share object with a new status will be
   * returned.
   *
   * @example
   * ```ts
   * const resourceSharing = await client.resourceSharing.update(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     name: 'My Shared WAF Managed Rule',
   *   },
   * );
   * ```
   */
  update(
    shareId: string,
    params: ResourceSharingUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceSharingUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/shares/${shareId}`, { body, ...options }) as Core.APIPromise<{
        result: ResourceSharingUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all account shares.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const resourceSharingListResponse of client.resourceSharing.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: ResourceSharingListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ResourceSharingListResponsesV4PagePaginationArray, ResourceSharingListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/shares`,
      ResourceSharingListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletion is not immediate, an updated share object with a new status will be
   * returned.
   *
   * @example
   * ```ts
   * const resourceSharing = await client.resourceSharing.delete(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    shareId: string,
    params: ResourceSharingDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceSharingDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/shares/${shareId}`, options) as Core.APIPromise<{
        result: ResourceSharingDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches share by ID.
   *
   * @example
   * ```ts
   * const resourceSharing = await client.resourceSharing.get(
   *   '3fd85f74b32742f1bff64a85009dda07',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    shareId: string,
    params: ResourceSharingGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceSharingGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/shares/${shareId}`, options) as Core.APIPromise<{
        result: ResourceSharingGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ResourceSharingListResponsesV4PagePaginationArray extends V4PagePaginationArray<ResourceSharingListResponse> {}

export interface ResourceSharingCreateResponse {
  /**
   * Share identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * The display name of an account.
   */
  account_name: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * The name of the share.
   */
  name: string;

  /**
   * Organization identifier.
   */
  organization_id: string;

  status: 'active' | 'deleting' | 'deleted';

  target_type: 'account' | 'organization';

  kind?: 'sent' | 'received';
}

export interface ResourceSharingUpdateResponse {
  /**
   * Share identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * The display name of an account.
   */
  account_name: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * The name of the share.
   */
  name: string;

  /**
   * Organization identifier.
   */
  organization_id: string;

  status: 'active' | 'deleting' | 'deleted';

  target_type: 'account' | 'organization';

  kind?: 'sent' | 'received';
}

export interface ResourceSharingListResponse {
  /**
   * Share identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * The display name of an account.
   */
  account_name: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * The name of the share.
   */
  name: string;

  /**
   * Organization identifier.
   */
  organization_id: string;

  status: 'active' | 'deleting' | 'deleted';

  target_type: 'account' | 'organization';

  kind?: 'sent' | 'received';
}

export interface ResourceSharingDeleteResponse {
  /**
   * Share identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * The display name of an account.
   */
  account_name: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * The name of the share.
   */
  name: string;

  /**
   * Organization identifier.
   */
  organization_id: string;

  status: 'active' | 'deleting' | 'deleted';

  target_type: 'account' | 'organization';

  kind?: 'sent' | 'received';
}

export interface ResourceSharingGetResponse {
  /**
   * Share identifier tag.
   */
  id: string;

  /**
   * Account identifier.
   */
  account_id: string;

  /**
   * The display name of an account.
   */
  account_name: string;

  /**
   * When the share was created.
   */
  created: string;

  /**
   * When the share was modified.
   */
  modified: string;

  /**
   * The name of the share.
   */
  name: string;

  /**
   * Organization identifier.
   */
  organization_id: string;

  status: 'active' | 'deleting' | 'deleted';

  target_type: 'account' | 'organization';

  kind?: 'sent' | 'received';
}

export interface ResourceSharingCreateParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Body param: The name of the share.
   */
  name: string;

  /**
   * Body param:
   */
  recipients: Array<ResourceSharingCreateParams.Recipient>;

  /**
   * Body param:
   */
  resources: Array<ResourceSharingCreateParams.Resource>;
}

export namespace ResourceSharingCreateParams {
  /**
   * Account or organization ID must be provided.
   */
  export interface Recipient {
    /**
     * Account identifier.
     */
    account_id?: string;

    /**
     * Organization identifier.
     */
    organization_id?: string;
  }

  export interface Resource {
    /**
     * Resource Metadata.
     */
    meta: unknown;

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
  }
}

export interface ResourceSharingUpdateParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Body param: The name of the share.
   */
  name: string;
}

export interface ResourceSharingListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Account identifier.
   */
  account_id: string;

  /**
   * Query param: Direction to sort objects.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Filter shares by kind.
   */
  kind?: 'sent' | 'received';

  /**
   * Query param: Order shares by values in the given field.
   */
  order?: 'name' | 'created';

  /**
   * Query param: Filter shares by status.
   */
  status?: 'active' | 'deleting' | 'deleted';

  /**
   * Query param: Filter shares by target_type.
   */
  target_type?: 'account' | 'organization';
}

export interface ResourceSharingDeleteParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

export interface ResourceSharingGetParams {
  /**
   * Account identifier.
   */
  account_id: string;
}

ResourceSharing.ResourceSharingListResponsesV4PagePaginationArray =
  ResourceSharingListResponsesV4PagePaginationArray;
ResourceSharing.Recipients = Recipients;
ResourceSharing.RecipientListResponsesV4PagePaginationArray = RecipientListResponsesV4PagePaginationArray;
ResourceSharing.Resources = Resources;
ResourceSharing.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;

export declare namespace ResourceSharing {
  export {
    type ResourceSharingCreateResponse as ResourceSharingCreateResponse,
    type ResourceSharingUpdateResponse as ResourceSharingUpdateResponse,
    type ResourceSharingListResponse as ResourceSharingListResponse,
    type ResourceSharingDeleteResponse as ResourceSharingDeleteResponse,
    type ResourceSharingGetResponse as ResourceSharingGetResponse,
    ResourceSharingListResponsesV4PagePaginationArray as ResourceSharingListResponsesV4PagePaginationArray,
    type ResourceSharingCreateParams as ResourceSharingCreateParams,
    type ResourceSharingUpdateParams as ResourceSharingUpdateParams,
    type ResourceSharingListParams as ResourceSharingListParams,
    type ResourceSharingDeleteParams as ResourceSharingDeleteParams,
    type ResourceSharingGetParams as ResourceSharingGetParams,
  };

  export {
    Recipients as Recipients,
    type RecipientCreateResponse as RecipientCreateResponse,
    type RecipientListResponse as RecipientListResponse,
    type RecipientDeleteResponse as RecipientDeleteResponse,
    type RecipientGetResponse as RecipientGetResponse,
    RecipientListResponsesV4PagePaginationArray as RecipientListResponsesV4PagePaginationArray,
    type RecipientCreateParams as RecipientCreateParams,
    type RecipientListParams as RecipientListParams,
    type RecipientDeleteParams as RecipientDeleteParams,
    type RecipientGetParams as RecipientGetParams,
  };

  export {
    Resources as Resources,
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
