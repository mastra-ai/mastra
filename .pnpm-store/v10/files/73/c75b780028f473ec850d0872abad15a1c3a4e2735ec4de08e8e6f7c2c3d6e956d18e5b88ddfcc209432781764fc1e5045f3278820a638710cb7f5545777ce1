import { AnalyticsQueryOptions, AnalyticsResult, AnalyticsMetaData } from './analyticstypes';
import { Cluster } from './cluster';
import { StreamableRowPromise } from './streamablepromises';
/**
 * @internal
 */
export declare class AnalyticsExecutor {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * @internal
     */
    query<TRow = any>(query: string, options: AnalyticsQueryOptions): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData>;
}
