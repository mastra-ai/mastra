// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class IQI extends APIResource {
    /**
     * Retrieves a summary (percentiles) of bandwidth, latency, or DNS response time
     * from the Radar Internet Quality Index (IQI).
     *
     * @example
     * ```ts
     * const response = await client.radar.quality.iqi.summary({
     *   metric: 'BANDWIDTH',
     * });
     * ```
     */
    summary(query, options) {
        return this._client.get('/radar/quality/iqi/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves a time series (percentiles) of bandwidth, latency, or DNS response
     * time from the Radar Internet Quality Index (IQI).
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.quality.iqi.timeseriesGroups({
     *     metric: 'BANDWIDTH',
     *   });
     * ```
     */
    timeseriesGroups(query, options) {
        return this._client.get('/radar/quality/iqi/timeseries_groups', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=iqi.mjs.map