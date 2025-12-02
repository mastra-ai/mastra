// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as ConfigAPI from './config';
import {
  Config,
  ConfigCreateParams,
  ConfigCreateResponse,
  ConfigDeleteParams,
  ConfigDeleteResponse,
  ConfigEditParams,
  ConfigEditResponse,
  ConfigListParams,
  ConfigListResponse,
  ConfigListResponsesSinglePage,
} from './config';
import * as ResultsAPI from './results';
import { ResultGetParams, ResultGetResponse, Results, ScanResult } from './results';

export class Scans extends APIResource {
  results: ResultsAPI.Results = new ResultsAPI.Results(this._client);
  config: ConfigAPI.Config = new ConfigAPI.Config(this._client);
}

Scans.Results = Results;
Scans.Config = Config;
Scans.ConfigListResponsesSinglePage = ConfigListResponsesSinglePage;

export declare namespace Scans {
  export {
    Results as Results,
    type ScanResult as ScanResult,
    type ResultGetResponse as ResultGetResponse,
    type ResultGetParams as ResultGetParams,
  };

  export {
    Config as Config,
    type ConfigCreateResponse as ConfigCreateResponse,
    type ConfigListResponse as ConfigListResponse,
    type ConfigDeleteResponse as ConfigDeleteResponse,
    type ConfigEditResponse as ConfigEditResponse,
    ConfigListResponsesSinglePage as ConfigListResponsesSinglePage,
    type ConfigCreateParams as ConfigCreateParams,
    type ConfigListParams as ConfigListParams,
    type ConfigDeleteParams as ConfigDeleteParams,
    type ConfigEditParams as ConfigEditParams,
  };
}
