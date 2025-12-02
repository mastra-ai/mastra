// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as BytimesAPI from './bytimes';
import { BytimeGetParams, BytimeGetResponse, Bytimes } from './bytimes';
import * as SummariesAPI from './summaries';
import { Summaries, SummaryGetParams, SummaryGetResponse } from './summaries';

export class Events extends APIResource {
  bytimes: BytimesAPI.Bytimes = new BytimesAPI.Bytimes(this._client);
  summaries: SummariesAPI.Summaries = new SummariesAPI.Summaries(this._client);
}

export type Dimension = 'event' | 'appID' | 'coloName' | 'ipVersion';

export type DimensionParam = 'event' | 'appID' | 'coloName' | 'ipVersion';

Events.Bytimes = Bytimes;
Events.Summaries = Summaries;

export declare namespace Events {
  export { type Dimension as Dimension };

  export {
    Bytimes as Bytimes,
    type BytimeGetResponse as BytimeGetResponse,
    type BytimeGetParams as BytimeGetParams,
  };

  export {
    Summaries as Summaries,
    type SummaryGetResponse as SummaryGetResponse,
    type SummaryGetParams as SummaryGetParams,
  };
}
