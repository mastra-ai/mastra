// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as AggregatesAPI from './aggregates/aggregates';
import { Aggregates } from './aggregates/aggregates';
import * as EventsAPI from './events/events';
import { Dimension, Events } from './events/events';

export class Analytics extends APIResource {
  aggregates: AggregatesAPI.Aggregates = new AggregatesAPI.Aggregates(this._client);
  events: EventsAPI.Events = new EventsAPI.Events(this._client);
}

Analytics.Aggregates = Aggregates;
Analytics.Events = Events;

export declare namespace Analytics {
  export { Aggregates as Aggregates };

  export { Events as Events, type Dimension as Dimension };
}
