// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as InsightsAPI from './insights/insights';
import {
  InsightDismissParams,
  InsightDismissResponse,
  InsightListParams,
  InsightListResponse,
  InsightListResponsesV4PagePagination,
  Insights,
} from './insights/insights';

export class SecurityCenter extends APIResource {
  insights: InsightsAPI.Insights = new InsightsAPI.Insights(this._client);
}

SecurityCenter.Insights = Insights;
SecurityCenter.InsightListResponsesV4PagePagination = InsightListResponsesV4PagePagination;

export declare namespace SecurityCenter {
  export {
    Insights as Insights,
    type InsightListResponse as InsightListResponse,
    type InsightDismissResponse as InsightDismissResponse,
    InsightListResponsesV4PagePagination as InsightListResponsesV4PagePagination,
    type InsightListParams as InsightListParams,
    type InsightDismissParams as InsightDismissParams,
  };
}
