// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as EligibleAPI from './eligible';
import { Eligible, EligibleGetParams, EligibleGetResponse } from './eligible';
import * as PagerdutyAPI from './pagerduty';
import {
  PagerdutiesSinglePage,
  Pagerduty,
  PagerdutyCreateParams,
  PagerdutyCreateResponse,
  PagerdutyDeleteParams,
  PagerdutyDeleteResponse,
  PagerdutyGetParams,
  PagerdutyLinkParams,
  PagerdutyLinkResponse,
  PagerdutyResource,
} from './pagerduty';
import * as WebhooksAPI from './webhooks';
import {
  WebhookCreateParams,
  WebhookCreateResponse,
  WebhookDeleteParams,
  WebhookDeleteResponse,
  WebhookGetParams,
  WebhookListParams,
  WebhookUpdateParams,
  WebhookUpdateResponse,
  Webhooks,
  WebhooksSinglePage,
} from './webhooks';

export class Destinations extends APIResource {
  eligible: EligibleAPI.Eligible = new EligibleAPI.Eligible(this._client);
  pagerduty: PagerdutyAPI.PagerdutyResource = new PagerdutyAPI.PagerdutyResource(this._client);
  webhooks: WebhooksAPI.Webhooks = new WebhooksAPI.Webhooks(this._client);
}

Destinations.Eligible = Eligible;
Destinations.PagerdutyResource = PagerdutyResource;
Destinations.PagerdutiesSinglePage = PagerdutiesSinglePage;
Destinations.WebhooksSinglePage = WebhooksSinglePage;

export declare namespace Destinations {
  export {
    Eligible as Eligible,
    type EligibleGetResponse as EligibleGetResponse,
    type EligibleGetParams as EligibleGetParams,
  };

  export {
    PagerdutyResource as PagerdutyResource,
    type Pagerduty as Pagerduty,
    type PagerdutyCreateResponse as PagerdutyCreateResponse,
    type PagerdutyDeleteResponse as PagerdutyDeleteResponse,
    type PagerdutyLinkResponse as PagerdutyLinkResponse,
    PagerdutiesSinglePage as PagerdutiesSinglePage,
    type PagerdutyCreateParams as PagerdutyCreateParams,
    type PagerdutyDeleteParams as PagerdutyDeleteParams,
    type PagerdutyGetParams as PagerdutyGetParams,
    type PagerdutyLinkParams as PagerdutyLinkParams,
  };

  export {
    type Webhooks as Webhooks,
    type WebhookCreateResponse as WebhookCreateResponse,
    type WebhookUpdateResponse as WebhookUpdateResponse,
    type WebhookDeleteResponse as WebhookDeleteResponse,
    WebhooksSinglePage as WebhooksSinglePage,
    type WebhookCreateParams as WebhookCreateParams,
    type WebhookUpdateParams as WebhookUpdateParams,
    type WebhookListParams as WebhookListParams,
    type WebhookDeleteParams as WebhookDeleteParams,
    type WebhookGetParams as WebhookGetParams,
  };
}
