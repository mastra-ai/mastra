// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Public extends APIResource {
  /**
   * List Public Finetunes
   */
  list(
    params: PublicListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PublicListResponsesSinglePage, PublicListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai/finetunes/public`,
      PublicListResponsesSinglePage,
      { query, ...options },
    );
  }
}

export class PublicListResponsesSinglePage extends SinglePage<PublicListResponse> {}

export interface PublicListResponse {
  id: string;

  created_at: string;

  model: string;

  modified_at: string;

  name: string;

  public: boolean;

  description?: string;
}

export interface PublicListParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Pagination Limit
   */
  limit?: number;

  /**
   * Query param: Pagination Offset
   */
  offset?: number;

  /**
   * Query param: Order By Column Name
   */
  orderBy?: string;
}

Public.PublicListResponsesSinglePage = PublicListResponsesSinglePage;

export declare namespace Public {
  export {
    type PublicListResponse as PublicListResponse,
    PublicListResponsesSinglePage as PublicListResponsesSinglePage,
    type PublicListParams as PublicListParams,
  };
}
