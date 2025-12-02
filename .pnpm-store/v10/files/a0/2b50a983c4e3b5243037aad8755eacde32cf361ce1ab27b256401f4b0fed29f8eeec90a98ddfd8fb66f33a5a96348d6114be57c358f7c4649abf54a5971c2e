// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as IQIAPI from './iqi';
import {
  IQI,
  IQISummaryParams,
  IQISummaryResponse,
  IQITimeseriesGroupsParams,
  IQITimeseriesGroupsResponse,
} from './iqi';
import * as SpeedAPI from './speed/speed';
import {
  Speed,
  SpeedHistogramParams,
  SpeedHistogramResponse,
  SpeedSummaryParams,
  SpeedSummaryResponse,
} from './speed/speed';

export class Quality extends APIResource {
  iqi: IQIAPI.IQI = new IQIAPI.IQI(this._client);
  speed: SpeedAPI.Speed = new SpeedAPI.Speed(this._client);
}

Quality.IQI = IQI;
Quality.Speed = Speed;

export declare namespace Quality {
  export {
    IQI as IQI,
    type IQISummaryResponse as IQISummaryResponse,
    type IQITimeseriesGroupsResponse as IQITimeseriesGroupsResponse,
    type IQISummaryParams as IQISummaryParams,
    type IQITimeseriesGroupsParams as IQITimeseriesGroupsParams,
  };

  export {
    Speed as Speed,
    type SpeedHistogramResponse as SpeedHistogramResponse,
    type SpeedSummaryResponse as SpeedSummaryResponse,
    type SpeedHistogramParams as SpeedHistogramParams,
    type SpeedSummaryParams as SpeedSummaryParams,
  };
}
