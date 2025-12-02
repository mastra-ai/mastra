import { Bucket } from './bucket';
import { Cluster } from './cluster';
import { StreamableRowPromise } from './streamablepromises';
import { ViewMetaData, ViewQueryOptions, ViewResult, ViewRow } from './viewtypes';
/**
 * @internal
 */
export declare class ViewExecutor {
    private _bucket;
    /**
     * @internal
     */
    constructor(bucket: Bucket);
    /**
    @internal
    */
    get _cluster(): Cluster;
    /**
     * @internal
     */
    query<TValue = any, TKey = any>(designDoc: string, viewName: string, options: ViewQueryOptions): StreamableRowPromise<ViewResult<TValue, TKey>, ViewRow<TValue, TKey>, ViewMetaData>;
}
