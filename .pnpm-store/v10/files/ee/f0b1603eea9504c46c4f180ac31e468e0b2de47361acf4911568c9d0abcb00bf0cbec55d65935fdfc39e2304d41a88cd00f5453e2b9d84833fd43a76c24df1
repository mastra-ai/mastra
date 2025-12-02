// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SpeedAPI from '../speed';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Tests extends APIResource {
  /**
   * Starts a test for a specific webpage, in a specific region.
   *
   * @example
   * ```ts
   * const test = await client.speed.pages.tests.create(
   *   'example.com',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  create(url: string, params: TestCreateParams, options?: Core.RequestOptions): Core.APIPromise<Test> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/speed_api/pages/${url}/tests`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Test }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Test history (list of tests) for a specific webpage.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const test of client.speed.pages.tests.list(
   *   'example.com',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    url: string,
    params: TestListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<TestsV4PagePaginationArray, Test> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/speed_api/pages/${url}/tests`,
      TestsV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes all tests for a specific webpage from a specific region. Deleted tests
   * are still counted as part of the quota.
   *
   * @example
   * ```ts
   * const test = await client.speed.pages.tests.delete(
   *   'example.com',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    url: string,
    params: TestDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TestDeleteResponse> {
    const { zone_id, region } = params;
    return (
      this._client.delete(`/zones/${zone_id}/speed_api/pages/${url}/tests`, {
        query: { region },
        ...options,
      }) as Core.APIPromise<{ result: TestDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the result of a specific test.
   *
   * @example
   * ```ts
   * const test = await client.speed.pages.tests.get(
   *   'example.com',
   *   'test_id',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    url: string,
    testId: string,
    params: TestGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Test> {
    const { zone_id } = params;
    return (
      this._client.get(
        `/zones/${zone_id}/speed_api/pages/${url}/tests/${testId}`,
        options,
      ) as Core.APIPromise<{ result: Test }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class TestsV4PagePaginationArray extends V4PagePaginationArray<Test> {}

export interface Test {
  /**
   * UUID.
   */
  id?: string;

  date?: string;

  /**
   * The Lighthouse report.
   */
  desktopReport?: SpeedAPI.LighthouseReport;

  /**
   * The Lighthouse report.
   */
  mobileReport?: SpeedAPI.LighthouseReport;

  /**
   * A test region with a label.
   */
  region?: SpeedAPI.LabeledRegion;

  /**
   * The frequency of the test.
   */
  scheduleFrequency?: 'DAILY' | 'WEEKLY';

  /**
   * A URL.
   */
  url?: string;
}

export interface TestDeleteResponse {
  /**
   * Number of items affected.
   */
  count?: number;
}

export interface TestCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: A test region.
   */
  region?:
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

export interface TestListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: A test region.
   */
  region?:
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

export interface TestDeleteParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: A test region.
   */
  region?:
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

export interface TestGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

Tests.TestsV4PagePaginationArray = TestsV4PagePaginationArray;

export declare namespace Tests {
  export {
    type Test as Test,
    type TestDeleteResponse as TestDeleteResponse,
    TestsV4PagePaginationArray as TestsV4PagePaginationArray,
    type TestCreateParams as TestCreateParams,
    type TestListParams as TestListParams,
    type TestDeleteParams as TestDeleteParams,
    type TestGetParams as TestGetParams,
  };
}
