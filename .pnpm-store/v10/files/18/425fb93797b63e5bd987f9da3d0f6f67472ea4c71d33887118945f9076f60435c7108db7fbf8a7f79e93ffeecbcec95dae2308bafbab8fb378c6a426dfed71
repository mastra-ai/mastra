// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Layer3API from './layer3/layer3';
import { Layer3, Layer3TimeseriesParams, Layer3TimeseriesResponse } from './layer3/layer3';
import * as Layer7API from './layer7/layer7';
import { Layer7, Layer7TimeseriesParams, Layer7TimeseriesResponse } from './layer7/layer7';

export class Attacks extends APIResource {
  layer3: Layer3API.Layer3 = new Layer3API.Layer3(this._client);
  layer7: Layer7API.Layer7 = new Layer7API.Layer7(this._client);
}

Attacks.Layer3 = Layer3;
Attacks.Layer7 = Layer7;

export declare namespace Attacks {
  export {
    Layer3 as Layer3,
    type Layer3TimeseriesResponse as Layer3TimeseriesResponse,
    type Layer3TimeseriesParams as Layer3TimeseriesParams,
  };

  export {
    Layer7 as Layer7,
    type Layer7TimeseriesResponse as Layer7TimeseriesResponse,
    type Layer7TimeseriesParams as Layer7TimeseriesParams,
  };
}
