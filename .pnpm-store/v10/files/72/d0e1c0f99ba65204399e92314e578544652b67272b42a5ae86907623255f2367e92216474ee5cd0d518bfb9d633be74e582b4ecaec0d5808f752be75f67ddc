// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AvailabilitiesAPI from './availabilities';
import { Availabilities, Availability, AvailabilityListParams } from './availabilities';
import * as ScheduleAPI from './schedule';
import {
  Schedule,
  ScheduleCreateParams,
  ScheduleCreateResponse,
  ScheduleDeleteParams,
  ScheduleDeleteResponse,
  ScheduleGetParams,
  ScheduleResource,
} from './schedule';
import * as PagesAPI from './pages/pages';
import {
  PageListParams,
  PageListResponse,
  PageListResponsesSinglePage,
  PageTrendParams,
  Pages,
} from './pages/pages';

export class Speed extends APIResource {
  schedule: ScheduleAPI.ScheduleResource = new ScheduleAPI.ScheduleResource(this._client);
  availabilities: AvailabilitiesAPI.Availabilities = new AvailabilitiesAPI.Availabilities(this._client);
  pages: PagesAPI.Pages = new PagesAPI.Pages(this._client);
}

/**
 * A test region with a label.
 */
export interface LabeledRegion {
  label?: string;

  /**
   * A test region.
   */
  value?:
    | 'asia-east1'
    | 'asia-northeast1'
    | 'asia-northeast2'
    | 'asia-south1'
    | 'asia-southeast1'
    | 'australia-southeast1'
    | 'europe-north1'
    | 'europe-southwest1'
    | 'europe-west1'
    | 'europe-west2'
    | 'europe-west3'
    | 'europe-west4'
    | 'europe-west8'
    | 'europe-west9'
    | 'me-west1'
    | 'southamerica-east1'
    | 'us-central1'
    | 'us-east1'
    | 'us-east4'
    | 'us-south1'
    | 'us-west1';
}

/**
 * The Lighthouse report.
 */
export interface LighthouseReport {
  /**
   * Cumulative Layout Shift.
   */
  cls?: number;

  /**
   * The type of device.
   */
  deviceType?: 'DESKTOP' | 'MOBILE';

  error?: LighthouseReport.Error;

  /**
   * First Contentful Paint.
   */
  fcp?: number;

  /**
   * The URL to the full Lighthouse JSON report.
   */
  jsonReportUrl?: string;

  /**
   * Largest Contentful Paint.
   */
  lcp?: number;

  /**
   * The Lighthouse performance score.
   */
  performanceScore?: number;

  /**
   * Speed Index.
   */
  si?: number;

  /**
   * The state of the Lighthouse report.
   */
  state?: 'RUNNING' | 'COMPLETE' | 'FAILED';

  /**
   * Total Blocking Time.
   */
  tbt?: number;

  /**
   * Time To First Byte.
   */
  ttfb?: number;

  /**
   * Time To Interactive.
   */
  tti?: number;
}

export namespace LighthouseReport {
  export interface Error {
    /**
     * The error code of the Lighthouse result.
     */
    code?: 'NOT_REACHABLE' | 'DNS_FAILURE' | 'NOT_HTML' | 'LIGHTHOUSE_TIMEOUT' | 'UNKNOWN';

    /**
     * Detailed error message.
     */
    detail?: string;

    /**
     * The final URL displayed to the user.
     */
    finalDisplayedUrl?: string;
  }
}

export interface Trend {
  /**
   * Cumulative Layout Shift trend.
   */
  cls?: Array<number | null>;

  /**
   * First Contentful Paint trend.
   */
  fcp?: Array<number | null>;

  /**
   * Largest Contentful Paint trend.
   */
  lcp?: Array<number | null>;

  /**
   * The Lighthouse score trend.
   */
  performanceScore?: Array<number | null>;

  /**
   * Speed Index trend.
   */
  si?: Array<number | null>;

  /**
   * Total Blocking Time trend.
   */
  tbt?: Array<number | null>;

  /**
   * Time To First Byte trend.
   */
  ttfb?: Array<number | null>;

  /**
   * Time To Interactive trend.
   */
  tti?: Array<number | null>;
}

Speed.ScheduleResource = ScheduleResource;
Speed.Availabilities = Availabilities;
Speed.Pages = Pages;
Speed.PageListResponsesSinglePage = PageListResponsesSinglePage;

export declare namespace Speed {
  export {
    type LabeledRegion as LabeledRegion,
    type LighthouseReport as LighthouseReport,
    type Trend as Trend,
  };

  export {
    ScheduleResource as ScheduleResource,
    type Schedule as Schedule,
    type ScheduleCreateResponse as ScheduleCreateResponse,
    type ScheduleDeleteResponse as ScheduleDeleteResponse,
    type ScheduleCreateParams as ScheduleCreateParams,
    type ScheduleDeleteParams as ScheduleDeleteParams,
    type ScheduleGetParams as ScheduleGetParams,
  };

  export {
    Availabilities as Availabilities,
    type Availability as Availability,
    type AvailabilityListParams as AvailabilityListParams,
  };

  export {
    Pages as Pages,
    type PageListResponse as PageListResponse,
    PageListResponsesSinglePage as PageListResponsesSinglePage,
    type PageListParams as PageListParams,
    type PageTrendParams as PageTrendParams,
  };
}
