// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as QuotaAPI from './quota';
import { Quota, QuotaGetParams, QuotaGetResponse } from './quota';
import * as StoresAPI from './stores/stores';
import {
  StoreCreateParams,
  StoreCreateResponse,
  StoreCreateResponsesSinglePage,
  StoreDeleteParams,
  StoreDeleteResponse,
  StoreListParams,
  StoreListResponse,
  StoreListResponsesV4PagePaginationArray,
  Stores,
} from './stores/stores';

export class SecretsStore extends APIResource {
  stores: StoresAPI.Stores = new StoresAPI.Stores(this._client);
  quota: QuotaAPI.Quota = new QuotaAPI.Quota(this._client);
}

SecretsStore.Stores = Stores;
SecretsStore.StoreCreateResponsesSinglePage = StoreCreateResponsesSinglePage;
SecretsStore.StoreListResponsesV4PagePaginationArray = StoreListResponsesV4PagePaginationArray;
SecretsStore.Quota = Quota;

export declare namespace SecretsStore {
  export {
    Stores as Stores,
    type StoreCreateResponse as StoreCreateResponse,
    type StoreListResponse as StoreListResponse,
    type StoreDeleteResponse as StoreDeleteResponse,
    StoreCreateResponsesSinglePage as StoreCreateResponsesSinglePage,
    StoreListResponsesV4PagePaginationArray as StoreListResponsesV4PagePaginationArray,
    type StoreCreateParams as StoreCreateParams,
    type StoreListParams as StoreListParams,
    type StoreDeleteParams as StoreDeleteParams,
  };

  export { Quota as Quota, type QuotaGetResponse as QuotaGetResponse, type QuotaGetParams as QuotaGetParams };
}
