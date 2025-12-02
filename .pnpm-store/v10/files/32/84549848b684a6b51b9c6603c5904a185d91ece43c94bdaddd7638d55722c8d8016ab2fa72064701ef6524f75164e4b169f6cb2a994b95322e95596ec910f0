import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SchemaValidationAPI from "./schema-validation.js";
import { SchemaValidation, SchemaValidationEditParams, SchemaValidationGetParams, SchemaValidationGetResponse, SchemaValidationUpdateParams, SchemaValidationUpdateResponse, SettingsMultipleRequest } from "./schema-validation.js";
import * as UserSchemasAPI from "../user-schemas/user-schemas.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Operations extends APIResource {
    schemaValidation: SchemaValidationAPI.SchemaValidation;
    /**
     * Add one operation to a zone. Endpoints can contain path variables. Host, method,
     * endpoint will be normalized to a canoncial form when creating an operation and
     * must be unique on the zone. Inserting an operation that matches an existing one
     * will return the record of the already existing operation and update its
     * last_updated date.
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.create(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     endpoint: '/api/v1/users/{var1}',
     *     host: 'www.example.com',
     *     method: 'GET',
     *   },
     * );
     * ```
     */
    create(params: OperationCreateParams, options?: Core.RequestOptions): Core.APIPromise<OperationCreateResponse>;
    /**
     * Retrieve information about all operations on a zone
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationListResponse of client.apiGateway.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: OperationListParams, options?: Core.RequestOptions): Core.PagePromise<OperationListResponsesV4PagePaginationArray, OperationListResponse>;
    /**
     * Delete an operation
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(operationId: string, params: OperationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<OperationDeleteResponse>;
    /**
     * Add one or more operations to a zone. Endpoints can contain path variables.
     * Host, method, endpoint will be normalized to a canoncial form when creating an
     * operation and must be unique on the zone. Inserting an operation that matches an
     * existing one will return the record of the already existing operation and update
     * its last_updated date.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationBulkCreateResponse of client.apiGateway.operations.bulkCreate(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [
     *       {
     *         endpoint: '/api/v1/users/{var1}',
     *         host: 'www.example.com',
     *         method: 'GET',
     *       },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkCreate(params: OperationBulkCreateParams, options?: Core.RequestOptions): Core.PagePromise<OperationBulkCreateResponsesSinglePage, OperationBulkCreateResponse>;
    /**
     * Delete multiple operations
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.operations.bulkDelete({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    bulkDelete(params: OperationBulkDeleteParams, options?: Core.RequestOptions): Core.APIPromise<OperationBulkDeleteResponse>;
    /**
     * Retrieve information about an operation
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(operationId: string, params: OperationGetParams, options?: Core.RequestOptions): Core.APIPromise<OperationGetResponse>;
}
export declare class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray<OperationListResponse> {
}
export declare class OperationBulkCreateResponsesSinglePage extends SinglePage<OperationBulkCreateResponse> {
}
export interface APIShield {
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
}
export interface OperationCreateResponse {
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
    features?: OperationCreateResponse.APIShieldOperationFeatureThresholds | OperationCreateResponse.APIShieldOperationFeatureParameterSchemas | OperationCreateResponse.APIShieldOperationFeatureAPIRouting | OperationCreateResponse.APIShieldOperationFeatureConfidenceIntervals | OperationCreateResponse.APIShieldOperationFeatureSchemaInfo;
}
export declare namespace OperationCreateResponse {
    interface APIShieldOperationFeatureThresholds {
        thresholds?: APIShieldOperationFeatureThresholds.Thresholds;
    }
    namespace APIShieldOperationFeatureThresholds {
        interface Thresholds {
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
    interface APIShieldOperationFeatureParameterSchemas {
        parameter_schemas: APIShieldOperationFeatureParameterSchemas.ParameterSchemas;
    }
    namespace APIShieldOperationFeatureParameterSchemas {
        interface ParameterSchemas {
            last_updated?: string;
            /**
             * An operation schema object containing a response.
             */
            parameter_schemas?: ParameterSchemas.ParameterSchemas;
        }
        namespace ParameterSchemas {
            /**
             * An operation schema object containing a response.
             */
            interface ParameterSchemas {
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
    interface APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        api_routing?: APIShieldOperationFeatureAPIRouting.APIRouting;
    }
    namespace APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        interface APIRouting {
            last_updated?: string;
            /**
             * Target route.
             */
            route?: string;
        }
    }
    interface APIShieldOperationFeatureConfidenceIntervals {
        confidence_intervals?: APIShieldOperationFeatureConfidenceIntervals.ConfidenceIntervals;
    }
    namespace APIShieldOperationFeatureConfidenceIntervals {
        interface ConfidenceIntervals {
            last_updated?: string;
            suggested_threshold?: ConfidenceIntervals.SuggestedThreshold;
        }
        namespace ConfidenceIntervals {
            interface SuggestedThreshold {
                confidence_intervals?: SuggestedThreshold.ConfidenceIntervals;
                /**
                 * Suggested threshold.
                 */
                mean?: number;
            }
            namespace SuggestedThreshold {
                interface ConfidenceIntervals {
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
                namespace ConfidenceIntervals {
                    /**
                     * Upper and lower bound for percentile estimate
                     */
                    interface P90 {
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
                    interface P95 {
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
                    interface P99 {
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
    interface APIShieldOperationFeatureSchemaInfo {
        schema_info?: APIShieldOperationFeatureSchemaInfo.SchemaInfo;
    }
    namespace APIShieldOperationFeatureSchemaInfo {
        interface SchemaInfo {
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
        namespace SchemaInfo {
            /**
             * Schema active on endpoint.
             */
            interface ActiveSchema {
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
export interface OperationListResponse {
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
    features?: OperationListResponse.APIShieldOperationFeatureThresholds | OperationListResponse.APIShieldOperationFeatureParameterSchemas | OperationListResponse.APIShieldOperationFeatureAPIRouting | OperationListResponse.APIShieldOperationFeatureConfidenceIntervals | OperationListResponse.APIShieldOperationFeatureSchemaInfo;
}
export declare namespace OperationListResponse {
    interface APIShieldOperationFeatureThresholds {
        thresholds?: APIShieldOperationFeatureThresholds.Thresholds;
    }
    namespace APIShieldOperationFeatureThresholds {
        interface Thresholds {
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
    interface APIShieldOperationFeatureParameterSchemas {
        parameter_schemas: APIShieldOperationFeatureParameterSchemas.ParameterSchemas;
    }
    namespace APIShieldOperationFeatureParameterSchemas {
        interface ParameterSchemas {
            last_updated?: string;
            /**
             * An operation schema object containing a response.
             */
            parameter_schemas?: ParameterSchemas.ParameterSchemas;
        }
        namespace ParameterSchemas {
            /**
             * An operation schema object containing a response.
             */
            interface ParameterSchemas {
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
    interface APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        api_routing?: APIShieldOperationFeatureAPIRouting.APIRouting;
    }
    namespace APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        interface APIRouting {
            last_updated?: string;
            /**
             * Target route.
             */
            route?: string;
        }
    }
    interface APIShieldOperationFeatureConfidenceIntervals {
        confidence_intervals?: APIShieldOperationFeatureConfidenceIntervals.ConfidenceIntervals;
    }
    namespace APIShieldOperationFeatureConfidenceIntervals {
        interface ConfidenceIntervals {
            last_updated?: string;
            suggested_threshold?: ConfidenceIntervals.SuggestedThreshold;
        }
        namespace ConfidenceIntervals {
            interface SuggestedThreshold {
                confidence_intervals?: SuggestedThreshold.ConfidenceIntervals;
                /**
                 * Suggested threshold.
                 */
                mean?: number;
            }
            namespace SuggestedThreshold {
                interface ConfidenceIntervals {
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
                namespace ConfidenceIntervals {
                    /**
                     * Upper and lower bound for percentile estimate
                     */
                    interface P90 {
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
                    interface P95 {
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
                    interface P99 {
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
    interface APIShieldOperationFeatureSchemaInfo {
        schema_info?: APIShieldOperationFeatureSchemaInfo.SchemaInfo;
    }
    namespace APIShieldOperationFeatureSchemaInfo {
        interface SchemaInfo {
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
        namespace SchemaInfo {
            /**
             * Schema active on endpoint.
             */
            interface ActiveSchema {
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
export interface OperationDeleteResponse {
    errors: UserSchemasAPI.Message;
    messages: UserSchemasAPI.Message;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export interface OperationBulkCreateResponse {
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
    features?: OperationBulkCreateResponse.APIShieldOperationFeatureThresholds | OperationBulkCreateResponse.APIShieldOperationFeatureParameterSchemas | OperationBulkCreateResponse.APIShieldOperationFeatureAPIRouting | OperationBulkCreateResponse.APIShieldOperationFeatureConfidenceIntervals | OperationBulkCreateResponse.APIShieldOperationFeatureSchemaInfo;
}
export declare namespace OperationBulkCreateResponse {
    interface APIShieldOperationFeatureThresholds {
        thresholds?: APIShieldOperationFeatureThresholds.Thresholds;
    }
    namespace APIShieldOperationFeatureThresholds {
        interface Thresholds {
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
    interface APIShieldOperationFeatureParameterSchemas {
        parameter_schemas: APIShieldOperationFeatureParameterSchemas.ParameterSchemas;
    }
    namespace APIShieldOperationFeatureParameterSchemas {
        interface ParameterSchemas {
            last_updated?: string;
            /**
             * An operation schema object containing a response.
             */
            parameter_schemas?: ParameterSchemas.ParameterSchemas;
        }
        namespace ParameterSchemas {
            /**
             * An operation schema object containing a response.
             */
            interface ParameterSchemas {
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
    interface APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        api_routing?: APIShieldOperationFeatureAPIRouting.APIRouting;
    }
    namespace APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        interface APIRouting {
            last_updated?: string;
            /**
             * Target route.
             */
            route?: string;
        }
    }
    interface APIShieldOperationFeatureConfidenceIntervals {
        confidence_intervals?: APIShieldOperationFeatureConfidenceIntervals.ConfidenceIntervals;
    }
    namespace APIShieldOperationFeatureConfidenceIntervals {
        interface ConfidenceIntervals {
            last_updated?: string;
            suggested_threshold?: ConfidenceIntervals.SuggestedThreshold;
        }
        namespace ConfidenceIntervals {
            interface SuggestedThreshold {
                confidence_intervals?: SuggestedThreshold.ConfidenceIntervals;
                /**
                 * Suggested threshold.
                 */
                mean?: number;
            }
            namespace SuggestedThreshold {
                interface ConfidenceIntervals {
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
                namespace ConfidenceIntervals {
                    /**
                     * Upper and lower bound for percentile estimate
                     */
                    interface P90 {
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
                    interface P95 {
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
                    interface P99 {
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
    interface APIShieldOperationFeatureSchemaInfo {
        schema_info?: APIShieldOperationFeatureSchemaInfo.SchemaInfo;
    }
    namespace APIShieldOperationFeatureSchemaInfo {
        interface SchemaInfo {
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
        namespace SchemaInfo {
            /**
             * Schema active on endpoint.
             */
            interface ActiveSchema {
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
export interface OperationBulkDeleteResponse {
    errors: UserSchemasAPI.Message;
    messages: UserSchemasAPI.Message;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export interface OperationGetResponse {
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
    features?: OperationGetResponse.APIShieldOperationFeatureThresholds | OperationGetResponse.APIShieldOperationFeatureParameterSchemas | OperationGetResponse.APIShieldOperationFeatureAPIRouting | OperationGetResponse.APIShieldOperationFeatureConfidenceIntervals | OperationGetResponse.APIShieldOperationFeatureSchemaInfo;
}
export declare namespace OperationGetResponse {
    interface APIShieldOperationFeatureThresholds {
        thresholds?: APIShieldOperationFeatureThresholds.Thresholds;
    }
    namespace APIShieldOperationFeatureThresholds {
        interface Thresholds {
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
    interface APIShieldOperationFeatureParameterSchemas {
        parameter_schemas: APIShieldOperationFeatureParameterSchemas.ParameterSchemas;
    }
    namespace APIShieldOperationFeatureParameterSchemas {
        interface ParameterSchemas {
            last_updated?: string;
            /**
             * An operation schema object containing a response.
             */
            parameter_schemas?: ParameterSchemas.ParameterSchemas;
        }
        namespace ParameterSchemas {
            /**
             * An operation schema object containing a response.
             */
            interface ParameterSchemas {
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
    interface APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        api_routing?: APIShieldOperationFeatureAPIRouting.APIRouting;
    }
    namespace APIShieldOperationFeatureAPIRouting {
        /**
         * API Routing settings on endpoint.
         */
        interface APIRouting {
            last_updated?: string;
            /**
             * Target route.
             */
            route?: string;
        }
    }
    interface APIShieldOperationFeatureConfidenceIntervals {
        confidence_intervals?: APIShieldOperationFeatureConfidenceIntervals.ConfidenceIntervals;
    }
    namespace APIShieldOperationFeatureConfidenceIntervals {
        interface ConfidenceIntervals {
            last_updated?: string;
            suggested_threshold?: ConfidenceIntervals.SuggestedThreshold;
        }
        namespace ConfidenceIntervals {
            interface SuggestedThreshold {
                confidence_intervals?: SuggestedThreshold.ConfidenceIntervals;
                /**
                 * Suggested threshold.
                 */
                mean?: number;
            }
            namespace SuggestedThreshold {
                interface ConfidenceIntervals {
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
                namespace ConfidenceIntervals {
                    /**
                     * Upper and lower bound for percentile estimate
                     */
                    interface P90 {
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
                    interface P95 {
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
                    interface P99 {
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
    interface APIShieldOperationFeatureSchemaInfo {
        schema_info?: APIShieldOperationFeatureSchemaInfo.SchemaInfo;
    }
    namespace APIShieldOperationFeatureSchemaInfo {
        interface SchemaInfo {
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
        namespace SchemaInfo {
            /**
             * Schema active on endpoint.
             */
            interface ActiveSchema {
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
export interface OperationCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: The endpoint which can contain path parameter templates in curly
     * braces, each will be replaced from left to right with {varN}, starting with
     * {var1}, during insertion. This will further be Cloudflare-normalized upon
     * insertion. See:
     * https://developers.cloudflare.com/rules/normalization/how-it-works/.
     */
    endpoint: string;
    /**
     * Body param: RFC3986-compliant host.
     */
    host: string;
    /**
     * Body param: The HTTP method used to access the endpoint.
     */
    method: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PUT' | 'DELETE' | 'CONNECT' | 'PATCH' | 'TRACE';
}
export interface OperationListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Direction to order results.
     */
    direction?: 'asc' | 'desc';
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
     * Query param: Field to order by. When requesting a feature, the feature keys are
     * available for ordering as well, e.g., `thresholds.suggested_threshold`.
     */
    order?: 'method' | 'host' | 'endpoint' | 'thresholds.$key';
}
export interface OperationDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface OperationBulkCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: Array<OperationBulkCreateParams.Body>;
}
export declare namespace OperationBulkCreateParams {
    interface Body {
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
export interface OperationBulkDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface OperationGetParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Add feature(s) to the results. The feature name that is given here
     * corresponds to the resulting feature object. Have a look at the top-level object
     * description for more details on the specific meaning.
     */
    feature?: Array<'thresholds' | 'parameter_schemas' | 'schema_info'>;
}
export declare namespace Operations {
    export { type APIShield as APIShield, type OperationCreateResponse as OperationCreateResponse, type OperationListResponse as OperationListResponse, type OperationDeleteResponse as OperationDeleteResponse, type OperationBulkCreateResponse as OperationBulkCreateResponse, type OperationBulkDeleteResponse as OperationBulkDeleteResponse, type OperationGetResponse as OperationGetResponse, OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray, OperationBulkCreateResponsesSinglePage as OperationBulkCreateResponsesSinglePage, type OperationCreateParams as OperationCreateParams, type OperationListParams as OperationListParams, type OperationDeleteParams as OperationDeleteParams, type OperationBulkCreateParams as OperationBulkCreateParams, type OperationBulkDeleteParams as OperationBulkDeleteParams, type OperationGetParams as OperationGetParams, };
    export { SchemaValidation as SchemaValidation, type SettingsMultipleRequest as SettingsMultipleRequest, type SchemaValidationUpdateResponse as SchemaValidationUpdateResponse, type SchemaValidationGetResponse as SchemaValidationGetResponse, type SchemaValidationUpdateParams as SchemaValidationUpdateParams, type SchemaValidationEditParams as SchemaValidationEditParams, type SchemaValidationGetParams as SchemaValidationGetParams, };
}
//# sourceMappingURL=operations.d.ts.map