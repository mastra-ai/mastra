/**
 * Contains the results of a view query.
 *
 * @category Views
 */
export declare class ViewResult<TValue = any, TKey = any> {
    /**
     * The rows which have been returned by the query.
     */
    rows: ViewRow<TKey, TValue>[];
    /**
     * The meta-data which has been returned by the query.
     */
    meta: ViewMetaData;
    /**
     * @internal
     */
    constructor(data: ViewResult);
}
/**
 * Contains the meta-data that is returend from a view query.
 *
 * @category Views
 */
export declare class ViewMetaData {
    /**
     * The total number of rows available in the index that match the query.
     */
    totalRows?: number;
    /**
     * Contains various pieces of debug information exposed by the view service.
     */
    debug?: any;
    /**
     * @internal
     */
    constructor(data: {
        totalRows?: number;
        debug?: any;
    });
    /**
     * Same as {@link ViewMetaData.totalRows}, but represented as
     * the raw server-side value.
     *
     * @deprecated Use {@link ViewMetaData.totalRows} instead.
     */
    get total_rows(): number | undefined;
}
/**
 * Contains the contents of a single row returned by a view query.
 *
 * @category Views
 */
export declare class ViewRow<TValue = any, TKey = any> {
    /**
     * The value for this row.
     */
    value: TValue;
    /**
     * The key for this row.
     */
    key?: TKey;
    /**
     * The id for this row.
     */
    id?: string;
    /**
     * @internal
     */
    constructor(data: ViewRow);
}
/**
 * Specifies the namespace for the associated Design Document.
 *
 * @category Views
 */
export declare enum DesignDocumentNamespace {
    /**
     * Indicates that the Design Document namespace is within the development environment.
     */
    Development = "development",
    /**
     * Indicates that the Design Document namespace is within the producion environment.
     */
    Production = "production"
}
/**
 * Represents the various scan consistency options that are available when
 * querying against the views service.
 *
 * @category Views
 */
export declare enum ViewScanConsistency {
    /**
     * Indicates that no specific consistency is required, this is the fastest
     * options, but results may not include the most recent operations which have
     * been performed.
     */
    NotBounded = "ok",
    /**
     * Indicates that the results to the query should include all operations that
     * have occurred up until the query was started.  This incurs a performance
     * penalty of waiting for the index to catch up to the most recent operations,
     * but provides the highest level of consistency.
     */
    RequestPlus = "false",
    /**
     * Indicates that the results of the query should behave according to similar
     * semantics as NotBounded, but following the execution of the query the index
     * should begin updating such that following queries will likely include up
     * to date data.
     */
    UpdateAfter = "update_after"
}
/**
 * Specifies the ordering mode of a view query.
 *
 * @category Views
 */
export declare enum ViewOrdering {
    /**
     * Indicates that results should be returned in ascending order.
     */
    Ascending = "false",
    /**
     * Indicates that results should be returned in descending order.
     */
    Descending = "true"
}
/**
 * Specifies the error handling mode for a view query.
 *
 * @category Views
 */
export declare enum ViewErrorMode {
    /**
     * Indicates that if an error occurs during the execution of the view query,
     * the query should continue to process and include any available results.
     */
    Continue = "continue",
    /**
     * Indicates that if an error occurs during the execution of the view query,
     * the query should be aborted immediately rather than attempting to continue.
     */
    Stop = "stop"
}
/**
 * Specifies the key range for a view query.
 *
 * @category Views
 */
export interface ViewQueryKeyRange {
    /**
     * Specifies the first key that should be included in the results.
     */
    start?: string | string[];
    /**
     * Specifies the last key that should be included in the results.
     */
    end?: string | string[];
    /**
     * Specifies whether the end key should be considered inclusive or exclusive.
     */
    inclusiveEnd?: boolean;
    /**
     * Same as {@link ViewQueryKeyRange.inclusiveEnd}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryKeyRange.inclusiveEnd} instead.
     */
    inclusive_end?: boolean;
}
/**
 * Specifies the id range for a view query.
 *
 * @category Views
 */
export interface ViewQueryIdRange {
    /**
     * Specifies the first id that should be included in the results.
     */
    start?: string;
    /**
     * Specifies the last id (inclusively) that should be included in the results.
     */
    end?: string;
}
/**
 * @category Views
 */
export interface ViewQueryOptions {
    /**
     * Specifies the consistency requirements when executing the query.
     *
     * @see ViewScanConsistency
     */
    scanConsistency?: ViewScanConsistency;
    /**
     * Specifies the number of results to skip from the index before returning
     * results.
     */
    skip?: number;
    /**
     * Specifies the limit to the number of results that should be returned.
     */
    limit?: number;
    /**
     * Specifies the ordering that should be used when returning results.
     */
    order?: ViewOrdering;
    /**
     * Specifies whether reduction should be performed as part of the query.
     */
    reduce?: boolean;
    /**
     * Specifies whether the results should be grouped together.
     */
    group?: boolean;
    /**
     * Specifies the level to which results should be group.
     */
    groupLevel?: number;
    /**
     * Specifies a specific key which should be fetched from the index.
     */
    key?: string;
    /**
     * Specifies a list of keys which should be fetched from the index.
     */
    keys?: string[];
    /**
     * Specifies a range of keys that should be fetched from the index.
     */
    range?: ViewQueryKeyRange;
    /**
     * Specifies a range of ids that should be fetched from the index.
     */
    idRange?: ViewQueryIdRange;
    /**
     * Indicates whether the query should force the entire set of document in the index
     * to be included in the result.  This is on by default for production views and off
     * by default for development views (only a subset of results may be returned).
     */
    fullSet?: boolean;
    /**
     * Specifies the error-handling behaviour that should be used when an error occurs.
     */
    onError?: ViewErrorMode;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
    /**
     * Same as {@link ViewQueryOptions.scanConsistency}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryOptions.scanConsistency} instead.
     */
    stale?: string | ViewScanConsistency;
    /**
     * Same as {@link ViewQueryOptions.groupLevel}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryOptions.groupLevel} instead.
     */
    group_level?: number;
    /**
     * Same as {@link ViewQueryOptions.idRange}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryOptions.idRange} instead.
     */
    id_range?: ViewQueryIdRange;
    /**
     * Same as {@link ViewQueryOptions.fullSet}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryOptions.fullSet} instead.
     */
    full_set?: boolean;
    /**
     * Same as {@link ViewQueryOptions.onError}, but represented as
     * the raw server-side value instead.
     *
     * @deprecated Use {@link ViewQueryOptions.onError} instead.
     */
    on_error?: ViewErrorMode;
    /**
     * Specifies any additional parameters which should be passed to the view engine
     * when executing the view query.
     */
    raw?: {
        [key: string]: string;
    };
    /**
     * Specifies the design document namespace to use when executing the view query.
     */
    namespace?: DesignDocumentNamespace;
}
