// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Operations extends APIResource {
  /**
   * Retrieves all operations from the schema. Operations that already exist in API
   * Shield Endpoint Management will be returned as full operations.
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  list(
    schemaId: string,
    params: OperationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<OperationListResponsesV4PagePaginationArray, OperationListResponse> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/api_gateway/user_schemas/${schemaId}/operations`,
      OperationListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray<OperationListResponse> {}

export type OperationListResponse =
  | OperationListResponse.APIShieldOperation
  | OperationListResponse.APIShieldBasicOperation;

export namespace OperationListResponse {
  export interface APIShieldOperation {
    /**
     * The endpoint which can contain path parameter templates in curly braces, each
     * will be replaced from left to right with {varN}, starting with {var1}, during
     * insertion. This will further be Cloudflare-normalized upon insertion. See:
     * https://developers.cloudflare.com/rules/normalization/how-it-works/.
     */
    endpoint: string;

    /**
     * RFC3986-compliant host.
     */
    host: string;

    last_updated: string;

    /**
     * The HTTP method used to access the endpoint.
     */
    method: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PUT' | 'DELETE' | 'CONNECT' | 'PATCH' | 'TRACE';

    /**
     * UUID.
     */
    operation_id: string;

    features?:
      | APIShieldOperation.APIShieldOperationFeatureThresholds
      | APIShieldOperation.APIShieldOperationFeatureParameterSchemas
      | APIShieldOperation.APIShieldOperationFeatureAPIRouting
      | APIShieldOperation.APIShieldOperationFeatureConfidenceIntervals
      | APIShieldOperation.APIShieldOperationFeatureSchemaInfo;
  }

  export namespace APIShieldOperation {
    export interface APIShieldOperationFeatureThresholds {
      thresholds?: APIShieldOperationFeatureThresholds.Thresholds;
    }

    export namespace APIShieldOperationFeatureThresholds {
      export interface Thresholds {
        /**
         * The total number of auth-ids seen across this calculation.
         */
        auth_id_tokens?: number;

        /**
         * The number of data points used for the threshold suggestion calculation.
         */
        data_points?: number;

        last_updated?: string;

        /**
         * The p50 quantile of requests (in period_seconds).
         */
        p50?: number;

        /**
         * The p90 quantile of requests (in period_seconds).
         */
        p90?: number;

        /**
         * The p99 quantile of requests (in period_seconds).
         */
        p99?: number;

        /**
         * The period over which this threshold is suggested.
         */
        period_seconds?: number;

        /**
         * The estimated number of requests covered by these calculations.
         */
        requests?: number;

        /**
         * The suggested threshold in requests done by the same auth_id or period_seconds.
         */
        suggested_threshold?: number;
      }
    }

    export interface APIShieldOperationFeatureParameterSchemas {
      parameter_schemas: APIShieldOperationFeatureParameterSchemas.ParameterSchemas;
    }

    export namespace APIShieldOperationFeatureParameterSchemas {
      export interface ParameterSchemas {
        last_updated?: string;

        /**
         * An operation schema object containing a response.
         */
        parameter_schemas?: ParameterSchemas.ParameterSchemas;
      }

      export namespace ParameterSchemas {
        /**
         * An operation schema object containing a response.
         */
        export interface ParameterSchemas {
          /**
           * An array containing the learned parameter schemas.
           */
          parameters?: Array<unknown>;

          /**
           * An empty response object. This field is required to yield a valid operation
           * schema.
           */
          responses?: unknown | null;
        }
      }
    }

    export interface APIShieldOperationFeatureAPIRouting {
      /**
       * API Routing settings on endpoint.
       */
      api_routing?: APIShieldOperationFeatureAPIRouting.APIRouting;
    }

    export namespace APIShieldOperationFeatureAPIRouting {
      /**
       * API Routing settings on endpoint.
       */
      export interface APIRouting {
        last_updated?: string;

        /**
         * Target route.
         */
        route?: string;
      }
    }

    export interface APIShieldOperationFeatureConfidenceIntervals {
      confidence_intervals?: APIShieldOperationFeatureConfidenceIntervals.ConfidenceIntervals;
    }

    export namespace APIShieldOperationFeatureConfidenceIntervals {
      export interface ConfidenceIntervals {
        last_updated?: string;

        suggested_threshold?: ConfidenceIntervals.SuggestedThreshold;
      }

      export namespace ConfidenceIntervals {
        export interface SuggestedThreshold {
          confidence_intervals?: SuggestedThreshold.ConfidenceIntervals;

          /**
           * Suggested threshold.
           */
          mean?: number;
        }

        export namespace SuggestedThreshold {
          export interface ConfidenceIntervals {
            /**
             * Upper and lower bound for percentile estimate
             */
            p90?: ConfidenceIntervals.P90;

            /**
             * Upper and lower bound for percentile estimate
             */
            p95?: ConfidenceIntervals.P95;

            /**
             * Upper and lower bound for percentile estimate
             */
            p99?: ConfidenceIntervals.P99;
          }

          export namespace ConfidenceIntervals {
            /**
             * Upper and lower bound for percentile estimate
             */
            export interface P90 {
              /**
               * Lower bound for percentile estimate
               */
              lower?: number;

              /**
               * Upper bound for percentile estimate
               */
              upper?: number;
            }

            /**
             * Upper and lower bound for percentile estimate
             */
            export interface P95 {
              /**
               * Lower bound for percentile estimate
               */
              lower?: number;

              /**
               * Upper bound for percentile estimate
               */
              upper?: number;
            }

            /**
             * Upper and lower bound for percentile estimate
             */
            export interface P99 {
              /**
               * Lower bound for percentile estimate
               */
              lower?: number;

              /**
               * Upper bound for percentile estimate
               */
              upper?: number;
            }
          }
        }
      }
    }

    export interface APIShieldOperationFeatureSchemaInfo {
      schema_info?: APIShieldOperationFeatureSchemaInfo.SchemaInfo;
    }

    export namespace APIShieldOperationFeatureSchemaInfo {
      export interface SchemaInfo {
        /**
         * Schema active on endpoint.
         */
        active_schema?: SchemaInfo.ActiveSchema;

        /**
         * True if a Cloudflare-provided learned schema is available for this endpoint.
         */
        learned_available?: boolean;

        /**
         * Action taken on requests failing validation.
         */
        mitigation_action?: 'none' | 'log' | 'block' | null;
      }

      export namespace SchemaInfo {
        /**
         * Schema active on endpoint.
         */
        export interface ActiveSchema {
          /**
           * UUID.
           */
          id?: string;

          created_at?: string;

          /**
           * True if schema is Cloudflare-provided.
           */
          is_learned?: boolean;

          /**
           * Schema file name.
           */
          name?: string;
        }
      }
    }
  }

  export interface APIShieldBasicOperation {
    /**
     * The endpoint which can contain path parameter templates in curly braces, each
     * will be replaced from left to right with {varN}, starting with {var1}, during
     * insertion. This will further be Cloudflare-normalized upon insertion. See:
     * https://developers.cloudflare.com/rules/normalization/how-it-works/.
     */
    endpoint: string;

    /**
     * RFC3986-compliant host.
     */
    host: string;

    /**
     * The HTTP method used to access the endpoint.
     */
    method: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PUT' | 'DELETE' | 'CONNECT' | 'PATCH' | 'TRACE';
  }
}

export interface OperationListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param: Filter results to only include endpoints containing this pattern.
   */
  endpoint?: string;

  /**
   * Query param: Add feature(s) to the results. The feature name that is given here
   * corresponds to the resulting feature object. Have a look at the top-level object
   * description for more details on the specific meaning.
   */
  feature?: Array<'thresholds' | 'parameter_schemas' | 'schema_info'>;

  /**
   * Query param: Filter results to only include the specified hosts.
   */
  host?: Array<string>;

  /**
   * Query param: Filter results to only include the specified HTTP methods.
   */
  method?: Array<string>;

  /**
   * Query param: Filter results by whether operations exist in API Shield Endpoint
   * Management or not. `new` will just return operations from the schema that do not
   * exist in API Shield Endpoint Management. `existing` will just return operations
   * from the schema that already exist in API Shield Endpoint Management.
   */
  operation_status?: 'new' | 'existing';
}

Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;

export declare namespace Operations {
  export {
    type OperationListResponse as OperationListResponse,
    OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray,
    type OperationListParams as OperationListParams,
  };
}
