import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Metrics extends APIResource {
    /**
     * Get Storage/Object Count Metrics across all buckets in your account. Note that
     * Account-Level Metrics may not immediately reflect the latest data.
     *
     * @example
     * ```ts
     * const metrics = await client.r2.buckets.metrics.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params: MetricListParams, options?: Core.RequestOptions): Core.APIPromise<MetricListResponse>;
}
/**
 * Metrics based on the class they belong to.
 */
export interface MetricListResponse {
    /**
     * Metrics based on what state they are in(uploaded or published).
     */
    infrequentAccess?: MetricListResponse.InfrequentAccess;
    /**
     * Metrics based on what state they are in(uploaded or published).
     */
    standard?: MetricListResponse.Standard;
}
export declare namespace MetricListResponse {
    /**
     * Metrics based on what state they are in(uploaded or published).
     */
    interface InfrequentAccess {
        /**
         * Metrics on number of objects/amount of storage used.
         */
        published?: InfrequentAccess.Published;
        /**
         * Metrics on number of objects/amount of storage used.
         */
        uploaded?: InfrequentAccess.Uploaded;
    }
    namespace InfrequentAccess {
        /**
         * Metrics on number of objects/amount of storage used.
         */
        interface Published {
            /**
             * Amount of.
             */
            metadataSize?: number;
            /**
             * Number of objects stored.
             */
            objects?: number;
            /**
             * Amount of storage used by object data.
             */
            payloadSize?: number;
        }
        /**
         * Metrics on number of objects/amount of storage used.
         */
        interface Uploaded {
            /**
             * Amount of.
             */
            metadataSize?: number;
            /**
             * Number of objects stored.
             */
            objects?: number;
            /**
             * Amount of storage used by object data.
             */
            payloadSize?: number;
        }
    }
    /**
     * Metrics based on what state they are in(uploaded or published).
     */
    interface Standard {
        /**
         * Metrics on number of objects/amount of storage used.
         */
        published?: Standard.Published;
        /**
         * Metrics on number of objects/amount of storage used.
         */
        uploaded?: Standard.Uploaded;
    }
    namespace Standard {
        /**
         * Metrics on number of objects/amount of storage used.
         */
        interface Published {
            /**
             * Amount of.
             */
            metadataSize?: number;
            /**
             * Number of objects stored.
             */
            objects?: number;
            /**
             * Amount of storage used by object data.
             */
            payloadSize?: number;
        }
        /**
         * Metrics on number of objects/amount of storage used.
         */
        interface Uploaded {
            /**
             * Amount of.
             */
            metadataSize?: number;
            /**
             * Number of objects stored.
             */
            objects?: number;
            /**
             * Amount of storage used by object data.
             */
            payloadSize?: number;
        }
    }
}
export interface MetricListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Metrics {
    export { type MetricListResponse as MetricListResponse, type MetricListParams as MetricListParams };
}
//# sourceMappingURL=metrics.d.ts.map