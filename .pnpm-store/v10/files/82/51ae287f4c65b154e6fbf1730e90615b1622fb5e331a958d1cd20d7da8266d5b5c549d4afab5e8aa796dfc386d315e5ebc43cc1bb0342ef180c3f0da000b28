// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Authors extends APIResource {
  /**
   * Author Search
   */
  list(
    params: AuthorListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<AuthorListResponsesSinglePage, AuthorListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai/authors/search`,
      AuthorListResponsesSinglePage,
      options,
    );
  }
}

export class AuthorListResponsesSinglePage extends SinglePage<AuthorListResponse> {}

export type AuthorListResponse = unknown;

export interface AuthorListParams {
  account_id: string;
}

Authors.AuthorListResponsesSinglePage = AuthorListResponsesSinglePage;

export declare namespace Authors {
  export {
    type AuthorListResponse as AuthorListResponse,
    AuthorListResponsesSinglePage as AuthorListResponsesSinglePage,
    type AuthorListParams as AuthorListParams,
  };
}
