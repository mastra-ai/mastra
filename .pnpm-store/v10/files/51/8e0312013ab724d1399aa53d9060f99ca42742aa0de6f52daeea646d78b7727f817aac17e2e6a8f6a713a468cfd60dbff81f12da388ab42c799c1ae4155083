import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as DEXAPI from "../dex.js";
import * as PercentilesAPI from "./percentiles.js";
import { HTTPDetailsPercentiles, PercentileGetParams, Percentiles, TestStatOverTime } from "./percentiles.js";
export declare class HTTPTests extends APIResource {
    percentiles: PercentilesAPI.Percentiles;
    /**
     * Get test details and aggregate performance metrics for an http test for a given
     * time period between 1 hour and 7 days.
     *
     * @example
     * ```ts
     * const httpDetails =
     *   await client.zeroTrust.dex.httpTests.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '1689520412000',
     *       interval: 'minute',
     *       to: '1689606812000',
     *     },
     *   );
     * ```
     */
    get(testId: string, params: HTTPTestGetParams, options?: Core.RequestOptions): Core.APIPromise<HTTPDetails>;
}
export interface HTTPDetails {
    /**
     * The url of the HTTP synthetic application test
     */
    host?: string;
    httpStats?: HTTPDetails.HTTPStats | null;
    httpStatsByColo?: Array<HTTPDetails.HTTPStatsByColo>;
    /**
     * The interval at which the HTTP synthetic application test is set to run.
     */
    interval?: string;
    kind?: 'http';
    /**
     * The HTTP method to use when running the test
     */
    method?: string;
    /**
     * The name of the HTTP synthetic application test
     */
    name?: string;
    target_policies?: Array<DEXAPI.DigitalExperienceMonitor> | null;
    targeted?: boolean;
}
export declare namespace HTTPDetails {
    interface HTTPStats {
        availabilityPct: HTTPStats.AvailabilityPct;
        dnsResponseTimeMs: PercentilesAPI.TestStatOverTime;
        httpStatusCode: Array<HTTPStats.HTTPStatusCode>;
        resourceFetchTimeMs: PercentilesAPI.TestStatOverTime;
        serverResponseTimeMs: PercentilesAPI.TestStatOverTime;
        /**
         * Count of unique devices that have run this test in the given time period
         */
        uniqueDevicesTotal: number;
    }
    namespace HTTPStats {
        interface AvailabilityPct {
            slots: Array<AvailabilityPct.Slot>;
            /**
             * average observed in the time period
             */
            avg?: number | null;
            /**
             * highest observed in the time period
             */
            max?: number | null;
            /**
             * lowest observed in the time period
             */
            min?: number | null;
        }
        namespace AvailabilityPct {
            interface Slot {
                timestamp: string;
                value: number;
            }
        }
        interface HTTPStatusCode {
            status200: number;
            status300: number;
            status400: number;
            status500: number;
            timestamp: string;
        }
    }
    interface HTTPStatsByColo {
        availabilityPct: HTTPStatsByColo.AvailabilityPct;
        colo: string;
        dnsResponseTimeMs: PercentilesAPI.TestStatOverTime;
        httpStatusCode: Array<HTTPStatsByColo.HTTPStatusCode>;
        resourceFetchTimeMs: PercentilesAPI.TestStatOverTime;
        serverResponseTimeMs: PercentilesAPI.TestStatOverTime;
        /**
         * Count of unique devices that have run this test in the given time period
         */
        uniqueDevicesTotal: number;
    }
    namespace HTTPStatsByColo {
        interface AvailabilityPct {
            slots: Array<AvailabilityPct.Slot>;
            /**
             * average observed in the time period
             */
            avg?: number | null;
            /**
             * highest observed in the time period
             */
            max?: number | null;
            /**
             * lowest observed in the time period
             */
            min?: number | null;
        }
        namespace AvailabilityPct {
            interface Slot {
                timestamp: string;
                value: number;
            }
        }
        interface HTTPStatusCode {
            status200: number;
            status300: number;
            status400: number;
            status500: number;
            timestamp: string;
        }
    }
}
export interface HTTPTestGetParams {
    /**
     * Path param: unique identifier linked to an account in the API request path.
     */
    account_id: string;
    /**
     * Query param: Start time for aggregate metrics in ISO ms
     */
    from: string;
    /**
     * Query param: Time interval for aggregate time slots.
     */
    interval: 'minute' | 'hour';
    /**
     * Query param: End time for aggregate metrics in ISO ms
     */
    to: string;
    /**
     * Query param: Optionally filter result stats to a Cloudflare colo. Cannot be used
     * in combination with deviceId param.
     */
    colo?: string;
    /**
     * Query param: Optionally filter result stats to a specific device(s). Cannot be
     * used in combination with colo param.
     */
    deviceId?: Array<string>;
}
export declare namespace HTTPTests {
    export { type HTTPDetails as HTTPDetails, type HTTPTestGetParams as HTTPTestGetParams };
    export { Percentiles as Percentiles, type HTTPDetailsPercentiles as HTTPDetailsPercentiles, type TestStatOverTime as TestStatOverTime, type PercentileGetParams as PercentileGetParams, };
}
//# sourceMappingURL=http-tests.d.ts.map