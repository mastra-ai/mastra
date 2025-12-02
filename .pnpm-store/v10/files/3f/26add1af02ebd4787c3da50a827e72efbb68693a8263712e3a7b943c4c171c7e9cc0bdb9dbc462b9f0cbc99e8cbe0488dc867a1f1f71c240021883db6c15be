// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as SummaryAPI from './summary';
import {
  Summary,
  SummaryModelParams,
  SummaryModelResponse,
  SummaryTaskParams,
  SummaryTaskResponse,
} from './summary';
import * as TimeseriesGroupsAPI from './timeseries-groups/timeseries-groups';
import { TimeseriesGroups } from './timeseries-groups/timeseries-groups';

export class Inference extends APIResource {
  summary: SummaryAPI.Summary = new SummaryAPI.Summary(this._client);
  timeseriesGroups: TimeseriesGroupsAPI.TimeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(
    this._client,
  );
}

Inference.Summary = Summary;
Inference.TimeseriesGroups = TimeseriesGroups;

export declare namespace Inference {
  export {
    Summary as Summary,
    type SummaryModelResponse as SummaryModelResponse,
    type SummaryTaskResponse as SummaryTaskResponse,
    type SummaryModelParams as SummaryModelParams,
    type SummaryTaskParams as SummaryTaskParams,
  };

  export { TimeseriesGroups as TimeseriesGroups };
}
