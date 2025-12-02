// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as RequestsAPI from './requests/requests';
import {
  Item,
  ListItem,
  ListItemsSinglePage,
  Quota,
  RequestConstants,
  RequestConstantsParams,
  RequestCreateParams,
  RequestDeleteParams,
  RequestDeleteResponse,
  RequestGetParams,
  RequestListParams,
  RequestQuotaParams,
  RequestTypes,
  RequestTypesParams,
  RequestTypesResponse,
  RequestTypesResponsesSinglePage,
  RequestUpdateParams,
  Requests,
} from './requests/requests';
import * as ScansAPI from './scans/scans';
import { Scans } from './scans/scans';
import * as ThreatEventsAPI from './threat-events/threat-events';
import {
  ThreatEventBulkCreateParams,
  ThreatEventBulkCreateResponse,
  ThreatEventCreateParams,
  ThreatEventCreateResponse,
  ThreatEventDeleteParams,
  ThreatEventDeleteResponse,
  ThreatEventEditParams,
  ThreatEventEditResponse,
  ThreatEventGetParams,
  ThreatEventGetResponse,
  ThreatEventListParams,
  ThreatEventListResponse,
  ThreatEvents,
} from './threat-events/threat-events';

export class CloudforceOne extends APIResource {
  scans: ScansAPI.Scans = new ScansAPI.Scans(this._client);
  requests: RequestsAPI.Requests = new RequestsAPI.Requests(this._client);
  threatEvents: ThreatEventsAPI.ThreatEvents = new ThreatEventsAPI.ThreatEvents(this._client);
}

CloudforceOne.Scans = Scans;
CloudforceOne.Requests = Requests;
CloudforceOne.ListItemsSinglePage = ListItemsSinglePage;
CloudforceOne.RequestTypesResponsesSinglePage = RequestTypesResponsesSinglePage;
CloudforceOne.ThreatEvents = ThreatEvents;

export declare namespace CloudforceOne {
  export { Scans as Scans };

  export {
    Requests as Requests,
    type Item as Item,
    type ListItem as ListItem,
    type Quota as Quota,
    type RequestConstants as RequestConstants,
    type RequestTypes as RequestTypes,
    type RequestDeleteResponse as RequestDeleteResponse,
    type RequestTypesResponse as RequestTypesResponse,
    ListItemsSinglePage as ListItemsSinglePage,
    RequestTypesResponsesSinglePage as RequestTypesResponsesSinglePage,
    type RequestCreateParams as RequestCreateParams,
    type RequestUpdateParams as RequestUpdateParams,
    type RequestListParams as RequestListParams,
    type RequestDeleteParams as RequestDeleteParams,
    type RequestConstantsParams as RequestConstantsParams,
    type RequestGetParams as RequestGetParams,
    type RequestQuotaParams as RequestQuotaParams,
    type RequestTypesParams as RequestTypesParams,
  };

  export {
    ThreatEvents as ThreatEvents,
    type ThreatEventCreateResponse as ThreatEventCreateResponse,
    type ThreatEventListResponse as ThreatEventListResponse,
    type ThreatEventDeleteResponse as ThreatEventDeleteResponse,
    type ThreatEventBulkCreateResponse as ThreatEventBulkCreateResponse,
    type ThreatEventEditResponse as ThreatEventEditResponse,
    type ThreatEventGetResponse as ThreatEventGetResponse,
    type ThreatEventCreateParams as ThreatEventCreateParams,
    type ThreatEventListParams as ThreatEventListParams,
    type ThreatEventDeleteParams as ThreatEventDeleteParams,
    type ThreatEventBulkCreateParams as ThreatEventBulkCreateParams,
    type ThreatEventEditParams as ThreatEventEditParams,
    type ThreatEventGetParams as ThreatEventGetParams,
  };
}
