// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SpeedAPI from '../speed';
import * as TestsAPI from './tests';
import {
  Test,
  TestCreateParams,
  TestDeleteParams,
  TestDeleteResponse,
  TestGetParams,
  TestListParams,
  Tests,
  TestsV4PagePaginationArray,
} from './tests';
import { SinglePage } from '../../../pagination';

export class Pages extends APIResource {
  tests: TestsAPI.Tests = new TestsAPI.Tests(this._client);

  /**
   * Lists all webpages which have been tested.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const pageListResponse of client.speed.pages.list(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PageListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PageListResponsesSinglePage, PageListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(`/zones/${zone_id}/speed_api/pages`, PageListResponsesSinglePage, options);
  }

  /**
   * Lists the core web vital metrics trend over time for a specific page.
   *
   * @example
   * ```ts
   * const trend = await client.speed.pages.trend(
   *   'example.com',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     deviceType: 'DESKTOP',
   *     metrics: 'performanceScore,ttfb,fcp,si,lcp,tti,tbt,cls',
   *     region: 'us-central1',
   *     start: '2014-01-01T05:20:00.12345Z',
   *     tz: 'tz',
   *   },
   * );
   * ```
   */
  trend(
    url: string,
    params: PageTrendParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SpeedAPI.Trend> {
    const { zone_id, ...query } = params;
    return (
      this._client.get(`/zones/${zone_id}/speed_api/pages/${url}/trend`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: SpeedAPI.Trend }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PageListResponsesSinglePage extends SinglePage<PageListResponse> {}

export interface PageListResponse {
  /**
   * A test region with a label.
   */
  region?: SpeedAPI.LabeledRegion;

  /**
   * The frequency of the test.
   */
  scheduleFrequency?: 'DAILY' | 'WEEKLY';

  tests?: Array<TestsAPI.Test>;

  /**
   * A URL.
   */
  url?: string;
}

export interface PageListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface PageTrendParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: The type of device.
   */
  deviceType: 'DESKTOP' | 'MOBILE';

  /**
   * Query param: A comma-separated list of metrics to include in the results.
   */
  metrics: string;

  /**
   * Query param: A test region.
   */
  region:
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

  /**
   * Query param:
   */
  start: string;

  /**
   * Query param: The timezone of the start and end timestamps.
   */
  tz: string;

  /**
   * Query param:
   */
  end?: string;
}

Pages.PageListResponsesSinglePage = PageListResponsesSinglePage;
Pages.Tests = Tests;
Pages.TestsV4PagePaginationArray = TestsV4PagePaginationArray;

export declare namespace Pages {
  export {
    type PageListResponse as PageListResponse,
    PageListResponsesSinglePage as PageListResponsesSinglePage,
    type PageListParams as PageListParams,
    type PageTrendParams as PageTrendParams,
  };

  export {
    Tests as Tests,
    type Test as Test,
    type TestDeleteResponse as TestDeleteResponse,
    TestsV4PagePaginationArray as TestsV4PagePaginationArray,
    type TestCreateParams as TestCreateParams,
    type TestListParams as TestListParams,
    type TestDeleteParams as TestDeleteParams,
    type TestGetParams as TestGetParams,
  };
}
