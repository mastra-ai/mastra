// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class DEXTests extends APIResource {
  /**
   * Create a DEX test.
   *
   * @example
   * ```ts
   * const dexTest =
   *   await client.zeroTrust.devices.dexTests.create({
   *     account_id: '01a7362d577a6c3019a474fd6f485823',
   *     data: {},
   *     enabled: true,
   *     interval: '30m',
   *     name: 'HTTP dash health check',
   *   });
   * ```
   */
  create(params: DEXTestCreateParams, options?: Core.RequestOptions): Core.APIPromise<DEXTestCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dex/devices/dex_tests`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: DEXTestCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a DEX test.
   *
   * @example
   * ```ts
   * const dexTest =
   *   await client.zeroTrust.devices.dexTests.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '01a7362d577a6c3019a474fd6f485823',
   *       data: {},
   *       enabled: true,
   *       interval: '30m',
   *       name: 'HTTP dash health check',
   *     },
   *   );
   * ```
   */
  update(
    dexTestId: string,
    params: DEXTestUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DEXTestUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: DEXTestUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch all DEX tests
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const dexTestListResponse of client.zeroTrust.devices.dexTests.list(
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DEXTestListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DEXTestListResponsesSinglePage, DEXTestListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/dex/devices/dex_tests`,
      DEXTestListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete a Device DEX test. Returns the remaining device dex tests for the
   * account.
   *
   * @example
   * ```ts
   * const dexTest =
   *   await client.zeroTrust.devices.dexTests.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '01a7362d577a6c3019a474fd6f485823' },
   *   );
   * ```
   */
  delete(
    dexTestId: string,
    params: DEXTestDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DEXTestDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`,
        options,
      ) as Core.APIPromise<{ result: DEXTestDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a single DEX test.
   *
   * @example
   * ```ts
   * const dexTest = await client.zeroTrust.devices.dexTests.get(
   *   '372e67954025e0ba6aaa6d586b9e0b59',
   *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
   * );
   * ```
   */
  get(
    dexTestId: string,
    params: DEXTestGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DEXTestGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`,
        options,
      ) as Core.APIPromise<{ result: DEXTestGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DEXTestListResponsesSinglePage extends SinglePage<DEXTestListResponse> {}

/**
 * The configuration object which contains the details for the WARP client to
 * conduct the test.
 */
export interface SchemaData {
  /**
   * The desired endpoint to test.
   */
  host?: string;

  /**
   * The type of test.
   */
  kind?: string;

  /**
   * The HTTP request method type.
   */
  method?: string;
}

export interface SchemaHTTP {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  data: SchemaData;

  /**
   * Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * How often the test will run.
   */
  interval: string;

  /**
   * The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Additional details about the test.
   */
  description?: string;

  /**
   * Device settings profiles targeted by this test.
   */
  target_policies?: Array<SchemaHTTP.TargetPolicy>;

  targeted?: boolean;

  /**
   * The unique identifier for the test.
   */
  test_id?: string;
}

export namespace SchemaHTTP {
  export interface TargetPolicy {
    /**
     * The id of the device settings profile.
     */
    id?: string;

    /**
     * Whether the profile is the account default.
     */
    default?: boolean;

    /**
     * The name of the device settings profile.
     */
    name?: string;
  }
}

export interface DEXTestCreateResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  data: DEXTestCreateResponse.Data;

  /**
   * Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * How often the test will run.
   */
  interval: string;

  /**
   * The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Additional details about the test.
   */
  description?: string;

  /**
   * DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestCreateResponse.TargetPolicy>;

  targeted?: boolean;

  /**
   * The unique identifier for the test.
   */
  test_id?: string;
}

export namespace DEXTestCreateResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestUpdateResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  data: DEXTestUpdateResponse.Data;

  /**
   * Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * How often the test will run.
   */
  interval: string;

  /**
   * The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Additional details about the test.
   */
  description?: string;

  /**
   * DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestUpdateResponse.TargetPolicy>;

  targeted?: boolean;

  /**
   * The unique identifier for the test.
   */
  test_id?: string;
}

export namespace DEXTestUpdateResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestListResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  data: DEXTestListResponse.Data;

  /**
   * Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * How often the test will run.
   */
  interval: string;

  /**
   * The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Additional details about the test.
   */
  description?: string;

  /**
   * DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestListResponse.TargetPolicy>;

  targeted?: boolean;

  /**
   * The unique identifier for the test.
   */
  test_id?: string;
}

export namespace DEXTestListResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestDeleteResponse {
  dex_tests?: Array<DEXTestDeleteResponse.DEXTest>;
}

export namespace DEXTestDeleteResponse {
  export interface DEXTest {
    /**
     * The configuration object which contains the details for the WARP client to
     * conduct the test.
     */
    data: DEXTest.Data;

    /**
     * Determines whether or not the test is active.
     */
    enabled: boolean;

    /**
     * How often the test will run.
     */
    interval: string;

    /**
     * The name of the DEX test. Must be unique.
     */
    name: string;

    /**
     * Additional details about the test.
     */
    description?: string;

    /**
     * DEX rules targeted by this test
     */
    target_policies?: Array<DEXTest.TargetPolicy>;

    targeted?: boolean;

    /**
     * The unique identifier for the test.
     */
    test_id?: string;
  }

  export namespace DEXTest {
    /**
     * The configuration object which contains the details for the WARP client to
     * conduct the test.
     */
    export interface Data {
      /**
       * The desired endpoint to test.
       */
      host?: string;

      /**
       * The type of test.
       */
      kind?: string;

      /**
       * The HTTP request method type.
       */
      method?: string;
    }

    export interface TargetPolicy {
      /**
       * The id of the DEX rule
       */
      id?: string;

      /**
       * Whether the DEX rule is the account default
       */
      default?: boolean;

      /**
       * The name of the DEX rule
       */
      name?: string;
    }
  }
}

export interface DEXTestGetResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  data: DEXTestGetResponse.Data;

  /**
   * Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * How often the test will run.
   */
  interval: string;

  /**
   * The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Additional details about the test.
   */
  description?: string;

  /**
   * DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestGetResponse.TargetPolicy>;

  targeted?: boolean;

  /**
   * The unique identifier for the test.
   */
  test_id?: string;
}

export namespace DEXTestGetResponse {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The configuration object which contains the details for the WARP
   * client to conduct the test.
   */
  data: DEXTestCreateParams.Data;

  /**
   * Body param: Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * Body param: How often the test will run.
   */
  interval: string;

  /**
   * Body param: The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Body param: Additional details about the test.
   */
  description?: string;

  /**
   * Body param: DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestCreateParams.TargetPolicy>;

  /**
   * Body param:
   */
  targeted?: boolean;
}

export namespace DEXTestCreateParams {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The configuration object which contains the details for the WARP
   * client to conduct the test.
   */
  data: DEXTestUpdateParams.Data;

  /**
   * Body param: Determines whether or not the test is active.
   */
  enabled: boolean;

  /**
   * Body param: How often the test will run.
   */
  interval: string;

  /**
   * Body param: The name of the DEX test. Must be unique.
   */
  name: string;

  /**
   * Body param: Additional details about the test.
   */
  description?: string;

  /**
   * Body param: DEX rules targeted by this test
   */
  target_policies?: Array<DEXTestUpdateParams.TargetPolicy>;

  /**
   * Body param:
   */
  targeted?: boolean;
}

export namespace DEXTestUpdateParams {
  /**
   * The configuration object which contains the details for the WARP client to
   * conduct the test.
   */
  export interface Data {
    /**
     * The desired endpoint to test.
     */
    host?: string;

    /**
     * The type of test.
     */
    kind?: string;

    /**
     * The HTTP request method type.
     */
    method?: string;
  }

  export interface TargetPolicy {
    /**
     * The id of the DEX rule
     */
    id?: string;

    /**
     * Whether the DEX rule is the account default
     */
    default?: boolean;

    /**
     * The name of the DEX rule
     */
    name?: string;
  }
}

export interface DEXTestListParams {
  account_id: string;
}

export interface DEXTestDeleteParams {
  account_id: string;
}

export interface DEXTestGetParams {
  account_id: string;
}

DEXTests.DEXTestListResponsesSinglePage = DEXTestListResponsesSinglePage;

export declare namespace DEXTests {
  export {
    type SchemaData as SchemaData,
    type SchemaHTTP as SchemaHTTP,
    type DEXTestCreateResponse as DEXTestCreateResponse,
    type DEXTestUpdateResponse as DEXTestUpdateResponse,
    type DEXTestListResponse as DEXTestListResponse,
    type DEXTestDeleteResponse as DEXTestDeleteResponse,
    type DEXTestGetResponse as DEXTestGetResponse,
    DEXTestListResponsesSinglePage as DEXTestListResponsesSinglePage,
    type DEXTestCreateParams as DEXTestCreateParams,
    type DEXTestUpdateParams as DEXTestUpdateParams,
    type DEXTestListParams as DEXTestListParams,
    type DEXTestDeleteParams as DEXTestDeleteParams,
    type DEXTestGetParams as DEXTestGetParams,
  };
}
