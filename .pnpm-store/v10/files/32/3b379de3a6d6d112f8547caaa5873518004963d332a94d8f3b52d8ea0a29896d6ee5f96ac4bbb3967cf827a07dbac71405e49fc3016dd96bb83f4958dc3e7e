// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as V1API from './v1/v1';
import {
  Image,
  V1,
  V1CreateParams,
  V1DeleteParams,
  V1DeleteResponse,
  V1EditParams,
  V1GetParams,
  V1ListParams,
  V1ListResponse,
  V1ListResponsesV4PagePagination,
} from './v1/v1';
import * as V2API from './v2/v2';
import { V2, V2ListParams, V2ListResponse } from './v2/v2';

export class Images extends APIResource {
  v1: V1API.V1 = new V1API.V1(this._client);
  v2: V2API.V2 = new V2API.V2(this._client);
}

Images.V1 = V1;
Images.V1ListResponsesV4PagePagination = V1ListResponsesV4PagePagination;
Images.V2 = V2;

export declare namespace Images {
  export {
    V1 as V1,
    type Image as Image,
    type V1ListResponse as V1ListResponse,
    type V1DeleteResponse as V1DeleteResponse,
    V1ListResponsesV4PagePagination as V1ListResponsesV4PagePagination,
    type V1CreateParams as V1CreateParams,
    type V1ListParams as V1ListParams,
    type V1DeleteParams as V1DeleteParams,
    type V1EditParams as V1EditParams,
    type V1GetParams as V1GetParams,
  };

  export { V2 as V2, type V2ListResponse as V2ListResponse, type V2ListParams as V2ListParams };
}
