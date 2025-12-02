// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AvailableAlertsAPI from './available-alerts';
import { AvailableAlertListParams, AvailableAlertListResponse, AvailableAlerts } from './available-alerts';
import * as HistoryAPI from './history';
import { HistoriesV4PagePaginationArray, History, HistoryListParams, HistoryResource } from './history';
import * as PoliciesAPI from './policies';
import {
  Mechanism,
  Policies,
  PoliciesSinglePage,
  Policy,
  PolicyCreateParams,
  PolicyCreateResponse,
  PolicyDeleteParams,
  PolicyDeleteResponse,
  PolicyFilter,
  PolicyGetParams,
  PolicyListParams,
  PolicyUpdateParams,
  PolicyUpdateResponse,
} from './policies';
import * as DestinationsAPI from './destinations/destinations';
import { Destinations } from './destinations/destinations';

export class Alerting extends APIResource {
  availableAlerts: AvailableAlertsAPI.AvailableAlerts = new AvailableAlertsAPI.AvailableAlerts(this._client);
  destinations: DestinationsAPI.Destinations = new DestinationsAPI.Destinations(this._client);
  history: HistoryAPI.HistoryResource = new HistoryAPI.HistoryResource(this._client);
  policies: PoliciesAPI.Policies = new PoliciesAPI.Policies(this._client);
}

Alerting.AvailableAlerts = AvailableAlerts;
Alerting.Destinations = Destinations;
Alerting.HistoryResource = HistoryResource;
Alerting.HistoriesV4PagePaginationArray = HistoriesV4PagePaginationArray;
Alerting.Policies = Policies;
Alerting.PoliciesSinglePage = PoliciesSinglePage;

export declare namespace Alerting {
  export {
    AvailableAlerts as AvailableAlerts,
    type AvailableAlertListResponse as AvailableAlertListResponse,
    type AvailableAlertListParams as AvailableAlertListParams,
  };

  export { Destinations as Destinations };

  export {
    HistoryResource as HistoryResource,
    type History as History,
    HistoriesV4PagePaginationArray as HistoriesV4PagePaginationArray,
    type HistoryListParams as HistoryListParams,
  };

  export {
    Policies as Policies,
    type Mechanism as Mechanism,
    type Policy as Policy,
    type PolicyFilter as PolicyFilter,
    type PolicyCreateResponse as PolicyCreateResponse,
    type PolicyUpdateResponse as PolicyUpdateResponse,
    type PolicyDeleteResponse as PolicyDeleteResponse,
    PoliciesSinglePage as PoliciesSinglePage,
    type PolicyCreateParams as PolicyCreateParams,
    type PolicyUpdateParams as PolicyUpdateParams,
    type PolicyListParams as PolicyListParams,
    type PolicyDeleteParams as PolicyDeleteParams,
    type PolicyGetParams as PolicyGetParams,
  };
}
