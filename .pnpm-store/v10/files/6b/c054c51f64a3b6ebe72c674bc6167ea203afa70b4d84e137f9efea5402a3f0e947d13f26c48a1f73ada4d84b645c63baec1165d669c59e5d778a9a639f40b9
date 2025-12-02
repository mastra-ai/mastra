// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as AssetsAPI from './assets';
import { AssetCreateParams, AssetCreateResponse, Assets } from './assets';
import * as PublicAPI from './public';
import { Public, PublicListParams, PublicListResponse, PublicListResponsesSinglePage } from './public';

export class Finetunes extends APIResource {
  assets: AssetsAPI.Assets = new AssetsAPI.Assets(this._client);
  public: PublicAPI.Public = new PublicAPI.Public(this._client);

  /**
   * Create a new Finetune
   */
  create(
    params: FinetuneCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FinetuneCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/ai/finetunes`, { body, ...options }) as Core.APIPromise<{
        result: FinetuneCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Finetunes
   */
  list(params: FinetuneListParams, options?: Core.RequestOptions): Core.APIPromise<FinetuneListResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/ai/finetunes`, options) as Core.APIPromise<{
        result: FinetuneListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface FinetuneCreateResponse {
  id: string;

  created_at: string;

  model: string;

  modified_at: string;

  name: string;

  public: boolean;

  description?: string;
}

export interface FinetuneListResponse {
  id: string;

  created_at: string;

  model: string;

  modified_at: string;

  name: string;

  description?: string;
}

export interface FinetuneCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  model: string;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  public?: boolean;
}

export interface FinetuneListParams {
  account_id: string;
}

Finetunes.Assets = Assets;
Finetunes.Public = Public;
Finetunes.PublicListResponsesSinglePage = PublicListResponsesSinglePage;

export declare namespace Finetunes {
  export {
    type FinetuneCreateResponse as FinetuneCreateResponse,
    type FinetuneListResponse as FinetuneListResponse,
    type FinetuneCreateParams as FinetuneCreateParams,
    type FinetuneListParams as FinetuneListParams,
  };

  export {
    Assets as Assets,
    type AssetCreateResponse as AssetCreateResponse,
    type AssetCreateParams as AssetCreateParams,
  };

  export {
    Public as Public,
    type PublicListResponse as PublicListResponse,
    PublicListResponsesSinglePage as PublicListResponsesSinglePage,
    type PublicListParams as PublicListParams,
  };
}
