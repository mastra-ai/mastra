// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as SummaryAPI from './summary';
import {
  Summary,
  SummaryBotClassParams,
  SummaryBotClassResponse,
  SummaryCompromisedParams,
  SummaryCompromisedResponse,
} from './summary';
import * as TimeseriesGroupsAPI from './timeseries-groups';
import {
  TimeseriesGroupBotClassParams,
  TimeseriesGroupBotClassResponse,
  TimeseriesGroupCompromisedParams,
  TimeseriesGroupCompromisedResponse,
  TimeseriesGroups,
} from './timeseries-groups';

export class LeakedCredentials extends APIResource {
  summary: SummaryAPI.Summary = new SummaryAPI.Summary(this._client);
  timeseriesGroups: TimeseriesGroupsAPI.TimeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(
    this._client,
  );
}

LeakedCredentials.Summary = Summary;
LeakedCredentials.TimeseriesGroups = TimeseriesGroups;

export declare namespace LeakedCredentials {
  export {
    Summary as Summary,
    type SummaryBotClassResponse as SummaryBotClassResponse,
    type SummaryCompromisedResponse as SummaryCompromisedResponse,
    type SummaryBotClassParams as SummaryBotClassParams,
    type SummaryCompromisedParams as SummaryCompromisedParams,
  };

  export {
    TimeseriesGroups as TimeseriesGroups,
    type TimeseriesGroupBotClassResponse as TimeseriesGroupBotClassResponse,
    type TimeseriesGroupCompromisedResponse as TimeseriesGroupCompromisedResponse,
    type TimeseriesGroupBotClassParams as TimeseriesGroupBotClassParams,
    type TimeseriesGroupCompromisedParams as TimeseriesGroupCompromisedParams,
  };
}
