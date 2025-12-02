// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as AssetsAPI from './assets';
import {
  AssetCreateParams,
  AssetCreateResponse,
  AssetCreateResponsesSinglePage,
  AssetDeleteParams,
  AssetDeleteResponse,
  AssetGetParams,
  AssetGetResponse,
  AssetGetResponsesSinglePage,
  AssetUpdateParams,
  AssetUpdateResponse,
  Assets,
} from './assets';
import * as MessageAPI from './message';
import {
  Message as MessageAPIMessage,
  MessageCreateParams,
  MessageDeleteParams,
  MessageDeleteResponse,
  MessageGetParams,
  MessageResource,
  MessageUpdateParams,
  MessagesSinglePage,
} from './message';
import * as PriorityAPI from './priority';
import {
  Label,
  Priority,
  PriorityCreateParams,
  PriorityDeleteParams,
  PriorityDeleteResponse,
  PriorityEdit,
  PriorityGetParams,
  PriorityQuotaParams,
  PriorityResource,
  PriorityUpdateParams,
} from './priority';
import { SinglePage } from '../../../pagination';

export class Requests extends APIResource {
  message: MessageAPI.MessageResource = new MessageAPI.MessageResource(this._client);
  priority: PriorityAPI.PriorityResource = new PriorityAPI.PriorityResource(this._client);
  assets: AssetsAPI.Assets = new AssetsAPI.Assets(this._client);

  /**
   * Creating a request adds the request into the Cloudforce One queue for analysis.
   * In addition to the content, a short title, type, priority, and releasability
   * should be provided. If one is not provided, a default will be assigned.
   *
   * @example
   * ```ts
   * const item = await client.cloudforceOne.requests.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  create(params: RequestCreateParams, options?: Core.RequestOptions): Core.APIPromise<Item> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/cloudforce-one/requests/new`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Item }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updating a request alters the request in the Cloudforce One queue. This API may
   * be used to update any attributes of the request after the initial submission.
   * Only fields that you choose to update need to be add to the request body.
   *
   * @example
   * ```ts
   * const item = await client.cloudforceOne.requests.update(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    requestId: string,
    params: RequestUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Item> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/cloudforce-one/requests/${requestId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Item }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Requests
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const listItem of client.cloudforceOne.requests.list(
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     page: 0,
   *     per_page: 10,
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RequestListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ListItemsSinglePage, ListItem> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests`, ListItemsSinglePage, {
      body,
      method: 'post',
      ...options,
    });
  }

  /**
   * Delete a Request
   *
   * @example
   * ```ts
   * const request = await client.cloudforceOne.requests.delete(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    requestId: string,
    params: RequestDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RequestDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/cloudforce-one/requests/${requestId}`, options);
  }

  /**
   * Get Request Priority, Status, and TLP constants
   *
   * @example
   * ```ts
   * const requestConstants =
   *   await client.cloudforceOne.requests.constants({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  constants(
    params: RequestConstantsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RequestConstants> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/requests/constants`,
        options,
      ) as Core.APIPromise<{ result: RequestConstants }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a Request
   *
   * @example
   * ```ts
   * const item = await client.cloudforceOne.requests.get(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(requestId: string, params: RequestGetParams, options?: Core.RequestOptions): Core.APIPromise<Item> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/requests/${requestId}`,
        options,
      ) as Core.APIPromise<{ result: Item }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Request Quota
   *
   * @example
   * ```ts
   * const quota = await client.cloudforceOne.requests.quota({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  quota(params: RequestQuotaParams, options?: Core.RequestOptions): Core.APIPromise<Quota> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/cloudforce-one/requests/quota`, options) as Core.APIPromise<{
        result: Quota;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Request Types
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const requestTypesResponse of client.cloudforceOne.requests.types(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  types(
    params: RequestTypesParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RequestTypesResponsesSinglePage, RequestTypesResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/cloudforce-one/requests/types`,
      RequestTypesResponsesSinglePage,
      options,
    );
  }
}

export class ListItemsSinglePage extends SinglePage<ListItem> {}

export class RequestTypesResponsesSinglePage extends SinglePage<RequestTypesResponse> {}

export interface Item {
  /**
   * UUID.
   */
  id: string;

  /**
   * Request content.
   */
  content: string;

  created: string;

  priority: string;

  /**
   * Requested information from request.
   */
  request: string;

  /**
   * Brief description of the request.
   */
  summary: string;

  /**
   * The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';

  updated: string;

  completed?: string;

  /**
   * Tokens for the request messages.
   */
  message_tokens?: number;

  /**
   * Readable Request ID.
   */
  readable_id?: string;

  /**
   * Request Status.
   */
  status?: 'open' | 'accepted' | 'reported' | 'approved' | 'completed' | 'declined';

  /**
   * Tokens for the request.
   */
  tokens?: number;
}

export interface ListItem {
  /**
   * UUID.
   */
  id: string;

  /**
   * Request creation time.
   */
  created: string;

  priority: 'routine' | 'high' | 'urgent';

  /**
   * Requested information from request.
   */
  request: string;

  /**
   * Brief description of the request.
   */
  summary: string;

  /**
   * The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';

  /**
   * Request last updated time.
   */
  updated: string;

  /**
   * Request completion time.
   */
  completed?: string;

  /**
   * Tokens for the request messages.
   */
  message_tokens?: number;

  /**
   * Readable Request ID.
   */
  readable_id?: string;

  /**
   * Request Status.
   */
  status?: 'open' | 'accepted' | 'reported' | 'approved' | 'completed' | 'declined';

  /**
   * Tokens for the request.
   */
  tokens?: number;
}

export interface Quota {
  /**
   * Anniversary date is when annual quota limit is refreshed.
   */
  anniversary_date?: string;

  /**
   * Quarter anniversary date is when quota limit is refreshed each quarter.
   */
  quarter_anniversary_date?: string;

  /**
   * Tokens for the quarter.
   */
  quota?: number;

  /**
   * Tokens remaining for the quarter.
   */
  remaining?: number;
}

export interface RequestConstants {
  priority?: Array<'routine' | 'high' | 'urgent'>;

  status?: Array<'open' | 'accepted' | 'reported' | 'approved' | 'completed' | 'declined'>;

  tlp?: Array<'clear' | 'amber' | 'amber-strict' | 'green' | 'red'>;
}

export type RequestTypes = Array<RequestTypesResponse>;

export interface RequestDeleteResponse {
  errors: Array<RequestDeleteResponse.Error>;

  messages: Array<RequestDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace RequestDeleteResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }
}

/**
 * Request Types.
 */
export type RequestTypesResponse = string;

export interface RequestCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Request content.
   */
  content?: string;

  /**
   * Body param: Priority for analyzing the request.
   */
  priority?: string;

  /**
   * Body param: Requested information from request.
   */
  request_type?: string;

  /**
   * Body param: Brief description of the request.
   */
  summary?: string;

  /**
   * Body param: The CISA defined Traffic Light Protocol (TLP).
   */
  tlp?: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}

export interface RequestUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Request content.
   */
  content?: string;

  /**
   * Body param: Priority for analyzing the request.
   */
  priority?: string;

  /**
   * Body param: Requested information from request.
   */
  request_type?: string;

  /**
   * Body param: Brief description of the request.
   */
  summary?: string;

  /**
   * Body param: The CISA defined Traffic Light Protocol (TLP).
   */
  tlp?: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}

export interface RequestListParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Page number of results.
   */
  page: number;

  /**
   * Body param: Number of results per page.
   */
  per_page: number;

  /**
   * Body param: Retrieve requests completed after this time.
   */
  completed_after?: string;

  /**
   * Body param: Retrieve requests completed before this time.
   */
  completed_before?: string;

  /**
   * Body param: Retrieve requests created after this time.
   */
  created_after?: string;

  /**
   * Body param: Retrieve requests created before this time.
   */
  created_before?: string;

  /**
   * Body param: Requested information from request.
   */
  request_type?: string;

  /**
   * Body param: Field to sort results by.
   */
  sort_by?: string;

  /**
   * Body param: Sort order (asc or desc).
   */
  sort_order?: 'asc' | 'desc';

  /**
   * Body param: Request Status.
   */
  status?: 'open' | 'accepted' | 'reported' | 'approved' | 'completed' | 'declined';
}

export interface RequestDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface RequestConstantsParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface RequestGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface RequestQuotaParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface RequestTypesParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Requests.ListItemsSinglePage = ListItemsSinglePage;
Requests.RequestTypesResponsesSinglePage = RequestTypesResponsesSinglePage;
Requests.MessageResource = MessageResource;
Requests.MessagesSinglePage = MessagesSinglePage;
Requests.PriorityResource = PriorityResource;
Requests.Assets = Assets;
Requests.AssetCreateResponsesSinglePage = AssetCreateResponsesSinglePage;
Requests.AssetGetResponsesSinglePage = AssetGetResponsesSinglePage;

export declare namespace Requests {
  export {
    type Item as Item,
    type ListItem as ListItem,
    type Quota as Quota,
    type RequestConstants as RequestConstants,
    type RequestTypes as RequestTypes,
    type RequestDeleteResponse as RequestDeleteResponse,
    type RequestTypesResponse as RequestTypesResponse,
    ListItemsSinglePage as ListItemsSinglePage,
    RequestTypesResponsesSinglePage as RequestTypesResponsesSinglePage,
    type RequestCreateParams as RequestCreateParams,
    type RequestUpdateParams as RequestUpdateParams,
    type RequestListParams as RequestListParams,
    type RequestDeleteParams as RequestDeleteParams,
    type RequestConstantsParams as RequestConstantsParams,
    type RequestGetParams as RequestGetParams,
    type RequestQuotaParams as RequestQuotaParams,
    type RequestTypesParams as RequestTypesParams,
  };

  export {
    MessageResource as MessageResource,
    type MessageAPIMessage as Message,
    type MessageDeleteResponse as MessageDeleteResponse,
    MessagesSinglePage as MessagesSinglePage,
    type MessageCreateParams as MessageCreateParams,
    type MessageUpdateParams as MessageUpdateParams,
    type MessageDeleteParams as MessageDeleteParams,
    type MessageGetParams as MessageGetParams,
  };

  export {
    PriorityResource as PriorityResource,
    type Label as Label,
    type Priority as Priority,
    type PriorityEdit as PriorityEdit,
    type PriorityDeleteResponse as PriorityDeleteResponse,
    type PriorityCreateParams as PriorityCreateParams,
    type PriorityUpdateParams as PriorityUpdateParams,
    type PriorityDeleteParams as PriorityDeleteParams,
    type PriorityGetParams as PriorityGetParams,
    type PriorityQuotaParams as PriorityQuotaParams,
  };

  export {
    Assets as Assets,
    type AssetCreateResponse as AssetCreateResponse,
    type AssetUpdateResponse as AssetUpdateResponse,
    type AssetDeleteResponse as AssetDeleteResponse,
    type AssetGetResponse as AssetGetResponse,
    AssetCreateResponsesSinglePage as AssetCreateResponsesSinglePage,
    AssetGetResponsesSinglePage as AssetGetResponsesSinglePage,
    type AssetCreateParams as AssetCreateParams,
    type AssetUpdateParams as AssetUpdateParams,
    type AssetDeleteParams as AssetDeleteParams,
    type AssetGetParams as AssetGetParams,
  };
}
