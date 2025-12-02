import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as DEXAPI from "../dex.js";
export declare class Percentiles extends APIResource {
    /**
     * Get percentiles for an http test for a given time period between 1 hour and 7
     * days.
     *
     * @example
     * ```ts
     * const httpDetailsPercentiles =
     *   await client.zeroTrust.dex.httpTests.percentiles.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '2023-09-20T17:00:00Z',
     *       to: '2023-09-20T17:00:00Z',
     *     },
     *   );
     * ```
     */
    get(testId: string, params: PercentileGetParams, options?: Core.RequestOptions): Core.APIPromise<HTTPDetailsPercentiles>;
}
export interface HTTPDetailsPercentiles {
    dnsResponseTimeMs?: DEXAPI.Percentiles;
    resourceFetchTimeMs?: DEXAPI.Percentiles;
    serverResponseTimeMs?: DEXAPI.Percentiles;
}
export interface TestStatOverTime {
    slots: Array<TestStatOverTime.Slot>;
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
export declare namespace TestStatOverTime {
    interface Slot {
        timestamp: string;
        value: number;
    }
}
export interface PercentileGetParams {
    /**
     * Path param: unique identifier linked to an account in the API request path.
     */
    account_id: string;
    /**
     * Query param: Start time for the query in ISO (RFC3339 - ISO 8601) format
     */
    from: string;
    /**
     * Query param: End time for the query in ISO (RFC3339 - ISO 8601) format
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
export declare namespace Percentiles {
    export { type HTTPDetailsPercentiles as HTTPDetailsPercentiles, type TestStatOverTime as TestStatOverTime, type PercentileGetParams as PercentileGetParams, };
}
//# sourceMappingURL=percentiles.d.ts.map