// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as CustomAPI from './custom';
import {
  Custom,
  CustomCreateParams,
  CustomCreateResponse,
  CustomDeleteParams,
  CustomDeleteResponse,
  CustomGetParams,
  CustomGetResponse,
  CustomListParams,
  CustomListResponse,
  CustomUpdateParams,
  CustomUpdateResponse,
} from './custom';
import * as ManagedAPI from './managed';
import {
  Managed,
  ManagedListParams,
  ManagedListResponse,
  ManagedUpdateParams,
  ManagedUpdateResponse,
} from './managed';

export class Domains extends APIResource {
  custom: CustomAPI.Custom = new CustomAPI.Custom(this._client);
  managed: ManagedAPI.Managed = new ManagedAPI.Managed(this._client);
}

Domains.Custom = Custom;
Domains.Managed = Managed;

export declare namespace Domains {
  export {
    Custom as Custom,
    type CustomCreateResponse as CustomCreateResponse,
    type CustomUpdateResponse as CustomUpdateResponse,
    type CustomListResponse as CustomListResponse,
    type CustomDeleteResponse as CustomDeleteResponse,
    type CustomGetResponse as CustomGetResponse,
    type CustomCreateParams as CustomCreateParams,
    type CustomUpdateParams as CustomUpdateParams,
    type CustomListParams as CustomListParams,
    type CustomDeleteParams as CustomDeleteParams,
    type CustomGetParams as CustomGetParams,
  };

  export {
    Managed as Managed,
    type ManagedUpdateResponse as ManagedUpdateResponse,
    type ManagedListResponse as ManagedListResponse,
    type ManagedUpdateParams as ManagedUpdateParams,
    type ManagedListParams as ManagedListParams,
  };
}
