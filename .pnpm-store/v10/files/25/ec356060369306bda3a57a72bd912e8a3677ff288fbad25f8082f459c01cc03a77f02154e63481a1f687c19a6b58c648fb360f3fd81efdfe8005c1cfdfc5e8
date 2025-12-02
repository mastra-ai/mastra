import { SchemaFor } from './types.js';
import { ClientApi } from './openapi/generated_client_type.js';
export type QdrantClientParams = {
    port?: number | null;
    apiKey?: string;
    https?: boolean;
    prefix?: string;
    url?: string;
    host?: string;
    /**
     * Local timeout for requests (uses fetch's AbortSignal) - Default 300 seconds
     */
    timeout?: number;
    /**
     * Additional HTTP Headers to send.
     */
    headers?: Record<string, number | string | string[] | undefined>;
    /**
     * The Node.js fetch API (undici) uses HTTP/1.1 under the hood.
     * This indicates the maximum number of keep-alive connections
     * to open simultaneously while building a request pool in memory.
     */
    maxConnections?: number;
    /**
     * Check compatibility with the server version. Default: `true`
     */
    checkCompatibility?: boolean;
};
export declare class QdrantClient {
    private _https;
    private _scheme;
    private _port;
    private _prefix;
    private _host;
    private _restUri;
    private _openApiClient;
    constructor({ url, host, apiKey, https, prefix, port, timeout, checkCompatibility, ...args }?: QdrantClientParams);
    /**
     * API getter
     *
     * @returns An instance of an API, generated from OpenAPI schema.
     */
    api(): ClientApi;
    /**
     * Search for points in multiple collections
     *
     * @param collectionName Name of the collection
     * @param {object} args -
     *     - searches: List of search requests
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @returns List of search responses
     */
    searchBatch(collection_name: string, { searches, consistency, timeout, }: Pick<SchemaFor<'SearchRequestBatch'>, 'searches'> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[][]>;
    /**
     * Search for closest vectors in collection taking into account filtering conditions
     *
     * @param collection_name Collection to search in
     * @param {object} args -
     *      - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *      - vector:
     *          Search for vectors closest to this.
     *          Can be either a vector itself, or a named vector, or a tuple of vector name and vector itself
     *      - filter:
     *          - Exclude vectors which doesn't fit given conditions.
     *          - If `None` - search among all vectors
     *      - params: Additional search params
     *      - limit: How many results return
     *      - offset:
     *          Offset of the first result to return.
     *          May be used to paginate results.
     *          Note: large offset values may cause performance issues.
     *      - with_payload:
     *          - Specify which stored payload should be attached to the result.
     *          - If `True` - attach all payload
     *          - If `False` - do not attach any payload
     *          - If List of string - include only specified fields
     *          - If `PayloadSelector` - use explicit rules
     *      - with_vector:
     *          - If `True` - Attach stored vector to the search result.
     *          - If `False` - Do not attach vector.
     *          - If List of string - include only specified fields
     *          - Default: `False`
     *      - score_threshold:
     *          Define a minimal score threshold for the result.
     *          If defined, less similar results will not be returned.
     *          Score of the returned result might be higher or smaller than the threshold depending
     *          on the Distance function used.
     *          E.g. for cosine similarity only higher scores will be returned.
     *      - consistency:
     *          Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *          Values:
     *              - int - number of replicas to query, values should present in all queried replicas
     *              - 'majority' - query all replicas, but return values present in the majority of replicas
     *              - 'quorum' - query the majority of replicas, return values present in all of them
     *              - 'all' - query all replicas, and return values present in all replicas
     *      - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @example
     *     // Search with filter
     *     client.search(
     *         "test_collection",
     *         {
     *             vector: [1.0, 0.1, 0.2, 0.7],
     *             filter: {
     *                 must: [
     *                     {
     *                         key: 'color',
     *                         range: {
     *                             color: 'red'
     *                         }
     *                     }
     *                 ]
     *             )
     *         }
     *     )
     * @returns List of found close points with similarity scores.
     */
    search(collection_name: string, { shard_key, vector, limit, offset, filter, params, with_payload, with_vector, score_threshold, consistency, timeout, }: Partial<Pick<SchemaFor<'SearchRequest'>, 'limit'>> & Omit<SchemaFor<'SearchRequest'>, 'limit'> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[]>;
    /**
     * Perform multiple recommend requests in batch mode
     * @param collection_name Name of the collection
     * @param {object} args
     *     - searches: List of recommend requests
     *     - consistency:
     *         Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             - number - number of replicas to query, values should present in all queried replicas
     *             - 'majority' - query all replicas, but return values present in the majority of replicas
     *             - 'quorum' - query the majority of replicas, return values present in all of them
     *             - 'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @returns List of recommend responses
     */
    recommendBatch(collection_name: string, { searches, consistency, timeout, }: SchemaFor<'RecommendRequestBatch'> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[][]>;
    /**
     * @alias recommendBatch
     */
    recommend_batch(collection_name: string, { searches, consistency, timeout, }: SchemaFor<'RecommendRequestBatch'> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[][]>;
    /**
     * Recommendation request. Provides positive and negative examples of the vectors,
     * which can be ids of points that are already stored in the collection, raw vectors, or even ids and vectors combined.
     * Service should look for the points which are closer to positive examples and at the same time further to negative examples.
     * The concrete way of how to compare negative and positive distances is up to the `strategy` chosen.
     * @param collection_name Collection to search in
     * @param {object} args
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - positive:
     *         List of stored point IDs, which should be used as reference for similarity search.
     *         If there is only one ID provided - this request is equivalent to the regular search with vector of that point.
     *         If there are more than one IDs, Qdrant will attempt to search for similar to all of them.
     *         Recommendation for multiple vectors is experimental. Its behaviour may change in the future.
     *     - negative:
     *         List of stored point IDs, which should be dissimilar to the search result.
     *         Negative examples is an experimental functionality. Its behaviour may change in the future.
     *     - strategy:
     *         How to use positive and negative examples to find the results.
     *     - query_filter:
     *         - Exclude vectors which doesn't fit given conditions.
     *         - If `None` - search among all vectors
     *     - search_params: Additional search params
     *     - limit: How many results return
     *         - Default: `10`
     *     - offset:
     *         Offset of the first result to return.
     *         May be used to paginate results.
     *         Note: large offset values may cause performance issues.
     *         - Default: `0`
     *     - with_payload:
     *         - Specify which stored payload should be attached to the result.
     *         - If `True` - attach all payload
     *         - If `False` - do not attach any payload
     *         - If List of string - include only specified fields
     *         - If `PayloadSelector` - use explicit rules
     *         - Default: `true`
     *     - with_vector:
     *         - If `True` - Attach stored vector to the search result.
     *         - If `False` - Do not attach vector.
     *         - If List of string - include only specified fields
     *         - Default: `false`
     *     - score_threshold:
     *         Define a minimal score threshold for the result.
     *         If defined, less similar results will not be returned.
     *         Score of the returned result might be higher or smaller than the threshold depending
     *         on the Distance function used.
     *         E.g. for cosine similarity only higher scores will be returned.
     *     - using:
     *         Name of the vectors to use for recommendations.
     *         If `None` - use default vectors.
     *     - lookupFrom:
     *         Defines a location (collection and vector field name), used to lookup vectors for recommendations.
     *         If `None` - use current collection will be used.
     *     - consistency:
     *         Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *         - int - number of replicas to query, values should present in all queried replicas
     *         - 'majority' - query all replicas, but return values present in the majority of replicas
     *         - 'quorum' - query the majority of replicas, return values present in all of them
     *         - 'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @returns List of recommended points with similarity scores.
     */
    recommend(collection_name: string, { shard_key, positive, negative, strategy, filter, params, limit, offset, with_payload, with_vector, score_threshold, using, lookup_from, consistency, timeout, }: Omit<SchemaFor<'RecommendRequest'>, 'limit'> & Partial<Pick<SchemaFor<'RecommendRequest'>, 'limit'>> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[]>;
    /**
     * Scroll over all (matching) points in the collection.
     * @param collection_name Name of the collection
     * @param {object} args
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - filter: If provided - only returns points matching filtering conditions
     *     - limit: How many points to return
     *     - offset: If provided - skip points with ids less than given `offset`
     *     - with_payload:
     *         - Specify which stored payload should be attached to the result.
     *         - If `True` - attach all payload
     *         - If `False` - do not attach any payload
     *         - If List of string - include only specified fields
     *         - If `PayloadSelector` - use explicit rules
     *         - Default: `true`
     *     - with_vector:
     *         - If `True` - Attach stored vector to the search result.
     *         - If `False` - Do not attach vector.
     *         - If List of string - include only specified fields
     *         - Default: `false`
     *     - consistency:
     *         Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *         - int - number of replicas to query, values should present in all queried replicas
     *         - 'majority' - query all replicas, but return values present in the majority of replicas
     *         - 'quorum' - query the majority of replicas, return values present in all of them
     *         - 'all' - query all replicas, and return values present in all replicas
     *     - order_by:
     *         Order the records by a payload field.
     * @returns
     *     A pair of (List of points) and (optional offset for the next scroll request).
     *     If next page offset is `None` - there is no more points in the collection to scroll.
     */
    scroll(collection_name: string, { shard_key, filter, consistency, timeout, limit, offset, with_payload, with_vector, order_by, }?: SchemaFor<'ScrollRequest'> & {
        timeout?: number;
    } & {
        consistency?: SchemaFor<'ReadConsistency'>;
    }): Promise<{
        points: {
            id: string | number;
            payload?: Record<string, unknown> | {
                [key: string]: unknown;
            } | null | undefined;
            vector?: Record<string, unknown> | number[] | number[][] | {
                [key: string]: number[] | number[][] | {
                    indices: number[];
                    values: number[];
                } | undefined;
            } | null | undefined;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
            order_value?: number | Record<string, unknown> | null | undefined;
        }[];
        next_page_offset?: string | number | Record<string, unknown> | null | undefined;
    }>;
    /**
     * Count points in the collection.
     * Count points in the collection matching the given filter.
     * @param collection_name
     * @param {object} args
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - filter: filtering conditions
     *     - exact:
     *         If `True` - provide the exact count of points matching the filter.
     *         If `False` - provide the approximate count of points matching the filter. Works faster.
     *         Default: `true`
     * @returns Amount of points in the collection matching the filter.
     */
    count(collection_name: string, { shard_key, filter, exact, timeout }?: SchemaFor<'CountRequest'> & {
        timeout?: number;
    }): Promise<{
        count: number;
    }>;
    /**
     * Get cluster information for a collection.
     * @param collection_name
     * @returns Operation result
     */
    collectionClusterInfo(collection_name: string): Promise<{
        peer_id: number;
        shard_count: number;
        local_shards: {
            shard_id: number;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
            points_count: number;
            state: "Active" | "Dead" | "Partial" | "Initializing" | "Listener" | "PartialSnapshot" | "Recovery" | "Resharding" | "ReshardingScaleDown";
        }[];
        remote_shards: {
            shard_id: number;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
            peer_id: number;
            state: "Active" | "Dead" | "Partial" | "Initializing" | "Listener" | "PartialSnapshot" | "Recovery" | "Resharding" | "ReshardingScaleDown";
        }[];
        shard_transfers: {
            shard_id: number;
            to_shard_id?: number | null | undefined;
            from: number;
            to: number;
            sync: boolean;
            method?: Record<string, unknown> | "stream_records" | "snapshot" | "wal_delta" | "resharding_stream_records" | null | undefined;
            comment?: string | null | undefined;
        }[];
        resharding_operations?: {
            direction: "up" | "down";
            shard_id: number;
            peer_id: number;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
        }[] | null | undefined;
    }>;
    /**
     * Update collection cluster setup
     * @param collection_name Name of the collection
     * @param {object} args
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - operation: Cluster operation to perform. Can be one of:
     *         - move_shard: Move a shard from one peer to another
     *         - replicate_shard: Replicate a shard to another peer
     *         - abort_transfer: Abort an ongoing shard transfer
     *         - drop_replica: Drop a replica from a peer
     *         - create_sharding_key: Create a new sharding key
     *         - drop_sharding_key: Drop an existing sharding key
     *         - restart_transfer: Restart a failed shard transfer
     *         - start_resharding: Start resharding operation
     *         - abort_resharding: Abort an ongoing resharding operation
     * @returns Operation result
     */
    updateCollectionCluster(collection_name: string, { timeout, ...operation }: {
        timeout?: number;
    } & SchemaFor<'ClusterOperations'>): Promise<boolean>;
    /**
     * Update vectors
     * @param collection_name
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *         - Default: `true`
     *     - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - points: Points with named vectors
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     * @returns Operation result
     */
    updateVectors(collection_name: string, { wait, ordering, points, shard_key, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'UpdateVectors'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Delete vectors
     * @param collection_name
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *         - Default: `true`
     *     - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - points: Deletes values from each point in this list
     *     - filter: Deletes values from points that satisfy this filter condition
     *     - vector: Vector names
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     * @returns Operation result
     */
    deleteVectors(collection_name: string, { wait, ordering, points, filter, vector, shard_key, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'DeleteVectors'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Search point groups
     * @param collection_name
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - vector: query search vector
     *     - filter: Look only for points which satisfies this conditions
     *     - params: Additional search params
     *     - with_payload: Select which payload to return with the response
     *     - with_vector: Whether to return the point vector with the result?
     *     - score_threshold: Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
     *     - group_by: Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups.
     *     - group_size: Maximum amount of points to return per group
     *     - limit: Maximum amount of groups to return
     * @returns Operation result
     */
    searchPointGroups(collection_name: string, { consistency, timeout, shard_key, vector, filter, params, with_payload, with_vector, score_threshold, group_by, group_size, limit, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'SearchGroupsRequest'>): Promise<{
        groups: {
            hits: {
                id: string | number;
                version: number;
                score: number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            }[];
            id: string | number;
            lookup?: Record<string, unknown> | {
                id: string | number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            } | null | undefined;
        }[];
    }>;
    /**
     * Recommend point groups
     * @param collection_name
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - positive: Look for vectors closest to those
     *     - negative: Try to avoid vectors like this
     *     - strategy: How to use positive and negative examples to find the results
     *     - filter: Look only for points which satisfies this conditions
     *     - params: Additional search params
     *     - with_payload: Select which payload to return with the response
     *     - with_vector: Whether to return the point vector with the result?
     *     - score_threshold: Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
     *     - using: Define which vector to use for recommendation, if not specified - try to use default vector
     *     - lookup_from: The location used to lookup vectors. If not specified - use current collection. Note: the other collection should have the same vector size as the current collection
     *     - group_by: Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups.
     *     - group_size: Maximum amount of points to return per group
     *     - limit: Maximum amount of groups to return
     * @returns Operation result
     */
    recommendPointGroups(collection_name: string, { consistency, timeout, shard_key, positive, strategy, negative, filter, params, with_payload, with_vector, score_threshold, using, lookup_from, group_by, group_size, limit, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'RecommendGroupsRequest'>): Promise<{
        groups: {
            hits: {
                id: string | number;
                version: number;
                score: number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            }[];
            id: string | number;
            lookup?: Record<string, unknown> | {
                id: string | number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            } | null | undefined;
        }[];
    }>;
    /**
     * Update or insert a new point into the collection.
     * @param collection_name
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *         - Default: `true`
     *     - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - points: Batch or list of points to insert
     * @returns Operation result
     */
    upsert(collection_name: string, { wait, ordering, ...points_or_batch }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'PointInsertOperations'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Retrieve stored points by IDs
     * @param collection_name
     * @param {object} args
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - ids: list of IDs to lookup
     *     - with_payload:
     *         - Specify which stored payload should be attached to the result.
     *         - If `True` - attach all payload
     *         - If `False` - do not attach any payload
     *         - If List of string - include only specified fields
     *         - If `PayloadSelector` - use explicit rules
     *         - Default: `true`
     *     - with_vector:
     *         - If `True` - Attach stored vector to the search result.
     *         - If `False` - Do not attach vector.
     *         - If List of string - Attach only specified vectors.
     *         - Default: `false`
     *     - consistency:
     *         Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *             Values:
     *                 - number - number of replicas to query, values should present in all queried replicas
     *                 - 'majority' - query all replicas, but return values present in the majority of replicas
     *                 - 'quorum' - query the majority of replicas, return values present in all of them
     *                 - 'all' - query all replicas, and return values present in all replicas
     * @returns List of points
     */
    retrieve(collection_name: string, { shard_key, ids, with_payload, with_vector, consistency, timeout, }: SchemaFor<'PointRequest'> & {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    }): Promise<{
        id: string | number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[]>;
    /**
     * Deletes selected points from collection
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - points_selector: List of affected points, filter or points selector.
     *         Example:
     *             - `points: [
     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
     *               ]`
     *             - `filter: {
     *                    must: [
     *                        {
     *                            key: 'rand_number',
     *                            range: {
     *                                gte: 0.7
     *                            }
     *                        }
     *                    ]
     *                }`
     * @returns Operation result
     */
    delete(collection_name: string, { wait, ordering, ...points_selector }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'PointsSelector'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Sets payload values for specified points.
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - payload: Key-value pairs of payload to assign
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - key: Assigns payload to each point that satisfy this path of property
     *     - points|filter: List of affected points, filter or points selector.
     *         Example:
     *             - `points: [
     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
     *               ]`
     *             - `filter: {
     *                    must: [
     *                        {
     *                            key: 'rand_number',
     *                            range: {
     *                                gte: 0.7
     *                            }
     *                        }
     *                    ]
     *                }`
     * @returns Operation result
     */
    setPayload(collection_name: string, { payload, points, filter, shard_key, key, ordering, wait, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'SetPayload'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Overwrites payload of the specified points
     * After this operation is applied, only the specified payload will be present in the point.
     * The existing payload, even if the key is not specified in the payload, will be deleted.
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - payload: Key-value pairs of payload to assign
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - key: Assigns payload to each point that satisfy this path of property
     *     - points|filter: List of affected points, filter or points selector.
     *         Example:
     *             - `points: [
     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
     *               ]`
     *             - `filter: {
     *                    must: [
     *                        {
     *                            key: 'rand_number',
     *                            range: {
     *                                gte: 0.7
     *                            }
     *                        }
     *                    ]
     *                }`
     * @returns Operation result
     */
    overwritePayload(collection_name: string, { ordering, payload, points, filter, shard_key, key, wait, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'SetPayload'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Remove values from point's payload
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - keys: List of payload keys to remove.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - points|filter: List of affected points, filter or points selector.
     *         Example:
     *             - `points: [
     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
     *               ]`
     *             - `filter: {
     *                    must: [
     *                        {
     *                            key: 'rand_number',
     *                            range: {
     *                                gte: 0.7
     *                            }
     *                        }
     *                    ]
     *                }`
     * @returns Operation result
     */
    deletePayload(collection_name: string, { ordering, keys, points, filter, shard_key, wait, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'PointsSelector'> & SchemaFor<'DeletePayload'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Delete all payload for selected points
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *     - points_selector: List of affected points, filter or points selector.
     *         Example:
     *             - `points: [
     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
     *               ]`
     *             - `filter: {
     *                    must: [
     *                        {
     *                            key: 'rand_number',
     *                            range: {
     *                                gte: 0.7
     *                            }
     *                        }
     *                    ]
     *                }`
     * @returns Operation result
     */
    clearPayload(collection_name: string, { ordering, wait, ...points_selector }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'PointsSelector'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Operation for performing changes of collection aliases.
     * Alias changes are atomic, meaning that no collection modifications can happen between alias operations.
     * @param {object} args
     *     - actions: List of operations to perform
     *     - timeout: Wait for operation commit timeout in seconds. If timeout is reached, request will return with service error.
     * @returns Operation result
     */
    updateCollectionAliases({ actions, timeout }: {
        timeout?: number;
    } & SchemaFor<'ChangeAliasesOperation'>): Promise<boolean>;
    /**
     * Get collection aliases
     * @param collection_name Name of the collection
     * @returns Collection aliases
     */
    getCollectionAliases(collection_name: string): Promise<{
        aliases: {
            alias_name: string;
            collection_name: string;
        }[];
    }>;
    /**
     * Get all aliases
     * @returns All aliases of all collections
     */
    getAliases(): Promise<{
        aliases: {
            alias_name: string;
            collection_name: string;
        }[];
    }>;
    /**
     * Get list name of all existing collections
     * @returns List of the collections
     */
    getCollections(): Promise<{
        collections: {
            name: string;
        }[];
    }>;
    /**
     * Get detailed information about specified existing collection
     *
     * @param collection_name Name of the collection
     * @returns Detailed information about the collection
     */
    getCollection(collection_name: string): Promise<{
        status: "green" | "yellow" | "grey" | "red";
        optimizer_status: "ok" | {
            error: string;
        };
        vectors_count?: number | null | undefined;
        indexed_vectors_count?: number | null | undefined;
        points_count?: number | null | undefined;
        segments_count: number;
        config: {
            params: {
                vectors?: {
                    size: number;
                    distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
                    hnsw_config?: Record<string, unknown> | {
                        m?: number | null | undefined;
                        ef_construct?: number | null | undefined;
                        full_scan_threshold?: number | null | undefined;
                        max_indexing_threads?: number | null | undefined;
                        on_disk?: boolean | null | undefined;
                        payload_m?: number | null | undefined;
                    } | null | undefined;
                    quantization_config?: Record<string, unknown> | {
                        scalar: {
                            type: "int8";
                            quantile?: number | null | undefined;
                            always_ram?: boolean | null | undefined;
                        };
                    } | {
                        product: {
                            compression: "x4" | "x8" | "x16" | "x32" | "x64";
                            always_ram?: boolean | null | undefined;
                        };
                    } | {
                        binary: {
                            always_ram?: boolean | null | undefined;
                            encoding?: Record<string, unknown> | "one_bit" | "two_bits" | "one_and_half_bits" | null | undefined;
                            query_encoding?: Record<string, unknown> | "default" | "binary" | "scalar4bits" | "scalar8bits" | null | undefined;
                        };
                    } | null | undefined;
                    on_disk?: boolean | null | undefined;
                    datatype?: Record<string, unknown> | "float32" | "uint8" | "float16" | null | undefined;
                    multivector_config?: Record<string, unknown> | {
                        comparator: "max_sim";
                    } | null | undefined;
                } | {
                    [key: string]: {
                        size: number;
                        distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
                        hnsw_config?: Record<string, unknown> | {
                            m?: number | null | undefined;
                            ef_construct?: number | null | undefined;
                            full_scan_threshold?: number | null | undefined;
                            max_indexing_threads?: number | null | undefined;
                            on_disk?: boolean | null | undefined;
                            payload_m?: number | null | undefined;
                        } | null | undefined;
                        quantization_config?: Record<string, unknown> | {
                            scalar: {
                                type: "int8";
                                quantile?: number | null | undefined;
                                always_ram?: boolean | null | undefined;
                            };
                        } | {
                            product: {
                                compression: "x4" | "x8" | "x16" | "x32" | "x64";
                                always_ram?: boolean | null | undefined;
                            };
                        } | {
                            binary: {
                                always_ram?: boolean | null | undefined;
                                encoding?: Record<string, unknown> | "one_bit" | "two_bits" | "one_and_half_bits" | null | undefined;
                                query_encoding?: Record<string, unknown> | "default" | "binary" | "scalar4bits" | "scalar8bits" | null | undefined;
                            };
                        } | null | undefined;
                        on_disk?: boolean | null | undefined;
                        datatype?: Record<string, unknown> | "float32" | "uint8" | "float16" | null | undefined;
                        multivector_config?: Record<string, unknown> | {
                            comparator: "max_sim";
                        } | null | undefined;
                    } | undefined;
                } | undefined;
                shard_number?: number | undefined;
                sharding_method?: Record<string, unknown> | "auto" | "custom" | null | undefined;
                replication_factor?: number | undefined;
                write_consistency_factor?: number | undefined;
                read_fan_out_factor?: number | null | undefined;
                on_disk_payload?: boolean | undefined;
                sparse_vectors?: {
                    [key: string]: {
                        index?: Record<string, unknown> | {
                            full_scan_threshold?: number | null | undefined;
                            on_disk?: boolean | null | undefined;
                            datatype?: Record<string, unknown> | "float32" | "uint8" | "float16" | null | undefined;
                        } | null | undefined;
                        modifier?: Record<string, unknown> | "none" | "idf" | null | undefined;
                    } | undefined;
                } | null | undefined;
            };
            hnsw_config: {
                m: number;
                ef_construct: number;
                full_scan_threshold: number;
                max_indexing_threads?: number | undefined;
                on_disk?: boolean | null | undefined;
                payload_m?: number | null | undefined;
            };
            optimizer_config: {
                deleted_threshold: number;
                vacuum_min_vector_number: number;
                default_segment_number: number;
                max_segment_size?: number | null | undefined;
                memmap_threshold?: number | null | undefined;
                indexing_threshold?: number | null | undefined;
                flush_interval_sec: number;
                max_optimization_threads?: number | null | undefined;
            };
            wal_config?: Record<string, unknown> | {
                wal_capacity_mb: number;
                wal_segments_ahead: number;
            } | null | undefined;
            quantization_config?: Record<string, unknown> | {
                scalar: {
                    type: "int8";
                    quantile?: number | null | undefined;
                    always_ram?: boolean | null | undefined;
                };
            } | {
                product: {
                    compression: "x4" | "x8" | "x16" | "x32" | "x64";
                    always_ram?: boolean | null | undefined;
                };
            } | {
                binary: {
                    always_ram?: boolean | null | undefined;
                    encoding?: Record<string, unknown> | "one_bit" | "two_bits" | "one_and_half_bits" | null | undefined;
                    query_encoding?: Record<string, unknown> | "default" | "binary" | "scalar4bits" | "scalar8bits" | null | undefined;
                };
            } | null | undefined;
            strict_mode_config?: Record<string, unknown> | {
                enabled?: boolean | null | undefined;
                max_query_limit?: number | null | undefined;
                max_timeout?: number | null | undefined;
                unindexed_filtering_retrieve?: boolean | null | undefined;
                unindexed_filtering_update?: boolean | null | undefined;
                search_max_hnsw_ef?: number | null | undefined;
                search_allow_exact?: boolean | null | undefined;
                search_max_oversampling?: number | null | undefined;
                upsert_max_batchsize?: number | null | undefined;
                max_collection_vector_size_bytes?: number | null | undefined;
                read_rate_limit?: number | null | undefined;
                write_rate_limit?: number | null | undefined;
                max_collection_payload_size_bytes?: number | null | undefined;
                max_points_count?: number | null | undefined;
                filter_max_conditions?: number | null | undefined;
                condition_max_size?: number | null | undefined;
                multivector_config?: Record<string, unknown> | {
                    [key: string]: {
                        max_vectors?: number | null | undefined;
                    } | undefined;
                } | null | undefined;
                sparse_config?: Record<string, unknown> | {
                    [key: string]: {
                        max_length?: number | null | undefined;
                    } | undefined;
                } | null | undefined;
            } | null | undefined;
        };
        payload_schema: {
            [key: string]: {
                data_type: "keyword" | "integer" | "float" | "geo" | "text" | "bool" | "datetime" | "uuid";
                params?: Record<string, unknown> | {
                    type: "keyword";
                    is_tenant?: boolean | null | undefined;
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "integer";
                    lookup?: boolean | null | undefined;
                    range?: boolean | null | undefined;
                    is_principal?: boolean | null | undefined;
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "float";
                    is_principal?: boolean | null | undefined;
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "geo";
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "text";
                    tokenizer?: "prefix" | "whitespace" | "word" | "multilingual" | undefined;
                    min_token_len?: number | null | undefined;
                    /**
                     * Overwrites payload of the specified points
                     * After this operation is applied, only the specified payload will be present in the point.
                     * The existing payload, even if the key is not specified in the payload, will be deleted.
                     * @param collection_name Name of the collection
                     * @param {object} args
                     *     - wait: Await for the results to be processed.
                     *         - If `true`, result will be returned only when all changes are applied
                     *         - If `false`, result will be returned immediately after the confirmation of receiving.
                     *      - ordering: Define strategy for ordering of the points. Possible values:
                     *          - 'weak'   - write operations may be reordered, works faster, default
                     *          - 'medium' - write operations go through dynamically selected leader,
                     *                      may be inconsistent for a short period of time in case of leader change
                     *          - 'strong' - Write operations go through the permanent leader,
                     *                      consistent, but may be unavailable if leader is down
                     *     - payload: Key-value pairs of payload to assign
                     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
                     *     - key: Assigns payload to each point that satisfy this path of property
                     *     - points|filter: List of affected points, filter or points selector.
                     *         Example:
                     *             - `points: [
                     *                   1, 2, 3, "cd3b53f0-11a7-449f-bc50-d06310e7ed90"
                     *               ]`
                     *             - `filter: {
                     *                    must: [
                     *                        {
                     *                            key: 'rand_number',
                     *                            range: {
                     *                                gte: 0.7
                     *                            }
                     *                        }
                     *                    ]
                     *                }`
                     * @returns Operation result
                     */
                    max_token_len?: number | null | undefined;
                    lowercase?: boolean | null | undefined;
                    phrase_matching?: boolean | null | undefined;
                    stopwords?: Record<string, unknown> | "arabic" | "azerbaijani" | "basque" | "bengali" | "catalan" | "chinese" | "danish" | "dutch" | "english" | "finnish" | "french" | "german" | "greek" | "hebrew" | "hinglish" | "hungarian" | "indonesian" | "italian" | "japanese" | "kazakh" | "nepali" | "norwegian" | "portuguese" | "romanian" | "russian" | "slovene" | "spanish" | "swedish" | "tajik" | "turkish" | {
                        languages?: ("arabic" | "azerbaijani" | "basque" | "bengali" | "catalan" | "chinese" | "danish" | "dutch" | "english" | "finnish" | "french" | "german" | "greek" | "hebrew" | "hinglish" | "hungarian" | "indonesian" | "italian" | "japanese" | "kazakh" | "nepali" | "norwegian" | "portuguese" | "romanian" | "russian" | "slovene" | "spanish" | "swedish" | "tajik" | "turkish")[] | null | undefined;
                        custom?: string[] | null | undefined;
                    } | null | undefined;
                    on_disk?: boolean | null | undefined;
                    stemmer?: Record<string, unknown> | {
                        type: "snowball";
                        language: "arabic" | "danish" | "dutch" | "english" | "finnish" | "french" | "german" | "greek" | "hungarian" | "italian" | "norwegian" | "portuguese" | "romanian" | "russian" | "spanish" | "swedish" | "turkish" | "armenian" | "tamil";
                    } | null | undefined;
                } | {
                    type: "bool";
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "datetime";
                    is_principal?: boolean | null | undefined;
                    on_disk?: boolean | null | undefined;
                } | {
                    type: "uuid";
                    is_tenant?: boolean | null | undefined;
                    on_disk?: boolean | null | undefined;
                } | null | undefined;
                points: number;
            } | undefined;
        };
    }>;
    /**
     * Update parameters of the collection
     *
     * @param collection_name Name of the collection
     * @param {object} args
     *     - optimizer_config: Override for optimizer configuration
     *     - collection_params: Override for collection parameters
     *     - timeout: Wait for operation commit timeout in seconds. If timeout is reached, request will return with service error.
     * @returns Operation result
     */
    updateCollection(collection_name: string, args?: SchemaFor<'UpdateCollection'> & {
        timeout?: number;
    }): Promise<boolean>;
    /**
     * Removes collection and all it's data
     * @param collection_name Name of the collection to delete
     * @param {object} args
     *     - timeout:
     *         Wait for operation commit timeout in seconds.
     *         If timeout is reached, request will return with service error.
     * @returns Operation result
     */
    deleteCollection(collection_name: string, args?: {
        timeout?: number;
    }): Promise<boolean>;
    /**
     * Create empty collection with given parameters
     * @returns Operation result
     * @param collectionName Name of the collection to recreate
     * @param {object} args
     *     - vectors_config:
     *         Configuration of the vector storage. Vector params contains size and distance for the vector storage.
     *         If dict is passed, service will create a vector storage for each key in the dict.
     *         If single VectorParams is passed, service will create a single anonymous vector storage.
     *     - shard_number: Number of shards in collection. Default is 1, minimum is 1.
     *     - sharding_method: Sharding method Default is Auto - points are distributed across all available shards Custom - points are distributed across shards according to shard key
     *     - replication_factor:
     *         Replication factor for collection. Default is 1, minimum is 1.
     *         Defines how many copies of each shard will be created.
     *         Have effect only in distributed mode.
     *     - write_consistency_factor:
     *         Write consistency factor for collection. Default is 1, minimum is 1.
     *         Defines how many replicas should apply the operation for us to consider it successful.
     *         Increasing this number will make the collection more resilient to inconsistencies, but will
     *         also make it fail if not enough replicas are available.
     *         Does not have any performance impact.
     *         Have effect only in distributed mode.
     *     - on_disk_payload:
     *         If true - point`s payload will not be stored in memory.
     *         It will be read from the disk every time it is requested.
     *         This setting saves RAM by (slightly) increasing the response time.
     *         Note: those payload values that are involved in filtering and are indexed - remain in RAM.
     *     - hnsw_config: Params for HNSW index
     *     - optimizers_config: Params for optimizer
     *     - wal_config: Params for Write-Ahead-Log
     *     - quantization_config: Params for quantization, if None - quantization will be disabled
     *     - init_from: Use data stored in another collection to initialize this collection
     *     - sparse_vectors: Sparse vector data config
     *     - strict_mode_config: Strict mode configuration
     *     - timeout:
     *         Wait for operation commit timeout in seconds.
     *         If timeout is reached, request will return with service error.
     */
    createCollection(collection_name: string, { timeout, vectors, hnsw_config, init_from, on_disk_payload, optimizers_config, quantization_config, replication_factor, shard_number, sharding_method, wal_config, write_consistency_factor, sparse_vectors, strict_mode_config, }: {
        timeout?: number;
    } & SchemaFor<'CreateCollection'>): Promise<boolean>;
    /**
     * Delete and create empty collection with given parameters
     * @returns Operation result
     * @param collectionName Name of the collection to recreate
     * @param {object} args
     *     - vectorsConfig:
     *         Configuration of the vector storage. Vector params contains size and distance for the vector storage.
     *         If dict is passed, service will create a vector storage for each key in the dict.
     *         If single VectorParams is passed, service will create a single anonymous vector storage.
     *     - shardNumber: Number of shards in collection. Default is 1, minimum is 1.
     *     - sharding_method: Sharding method Default is Auto - points are distributed across all available shards Custom - points are distributed across shards according to shard key
     *     - replicationFactor:
     *         Replication factor for collection. Default is 1, minimum is 1.
     *         Defines how many copies of each shard will be created.
     *         Have effect only in distributed mode.
     *     - writeConsistencyFactor:
     *         Write consistency factor for collection. Default is 1, minimum is 1.
     *         Defines how many replicas should apply the operation for us to consider it successful.
     *         Increasing this number will make the collection more resilient to inconsistencies, but will
     *         also make it fail if not enough replicas are available.
     *         Does not have any performance impact.
     *         Have effect only in distributed mode.
     *     - onDiskPayload:
     *         If true - point`s payload will not be stored in memory.
     *         It will be read from the disk every time it is requested.
     *         This setting saves RAM by (slightly) increasing the response time.
     *         Note: those payload values that are involved in filtering and are indexed - remain in RAM.
     *     - hnswConfig: Params for HNSW index
     *     - optimizersConfig: Params for optimizer
     *     - walConfig: Params for Write-Ahead-Log
     *     - quantizationConfig: Params for quantization, if None - quantization will be disabled
     *     - initFrom: Use data stored in another collection to initialize this collection
     *     - sparse_vectors: Sparse vector data config
     *     - strict_mode_config: Strict mode configuration
     *     - timeout:
     *         Wait for operation commit timeout in seconds.
     *         If timeout is reached, request will return with service error.
     */
    recreateCollection(collection_name: string, { timeout, vectors, hnsw_config, init_from, on_disk_payload, optimizers_config, quantization_config, replication_factor, shard_number, sharding_method, wal_config, write_consistency_factor, sparse_vectors, strict_mode_config, }: {
        timeout?: number;
    } & SchemaFor<'CreateCollection'>): Promise<import("@qdrant/openapi-typescript-fetch").ApiResponse<{
        usage?: Record<string, unknown> | {
            cpu: number;
            payload_io_read: number;
            payload_io_write: number;
            payload_index_io_read: number;
            payload_index_io_write: number;
            vector_io_read: number;
            vector_io_write: number;
        } | null | undefined;
        time?: number | undefined; /**
         * @alias recommendBatch
         */
        status?: string | undefined;
        result?: boolean | undefined;
    }>>;
    /**
     * Creates index for a given payload field.
     * Indexed fields allow to perform filtered search operations faster.
     * @param collectionName Name of the collection
     * @param {object} args
     *     - fieldName: Name of the payload field.
     *     - fieldSchema: Type of data to index.
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *     - ordering:
     *         Define strategy for ordering of the points. Possible values:
     *         - 'weak'   - write operations may be reordered, works faster, default
     *         - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *         - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     * @returns Operation Result
     */
    createPayloadIndex(collection_name: string, { wait, ordering, field_name, field_schema, }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'CreateFieldIndex'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * Removes index for a given payload field.
     * @param collection_name Name of the collection
     * @param field_name Name of the payload field
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *     - ordering:
     *         Define strategy for ordering of the points. Possible values:
     *         - 'weak'   - write operations may be reordered, works faster, default
     *         - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *         - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     * @returns Operation Result
     */
    deletePayloadIndex(collection_name: string, field_name: string, { wait, ordering }?: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    }): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }>;
    /**
     * List all snapshots for a given collection
     * @param collection_name Name of the collection
     * @returns List of snapshots
     */
    listSnapshots(collection_name: string): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    }[]>;
    /**
     * Create snapshot for a given collection
     * @param collection_name Name of the collection
     * @returns Snapshot description
     */
    createSnapshot(collection_name: string, args?: {
        wait?: boolean;
    }): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    } | null>;
    /**
     * Delete snapshot for a given collection
     * @param collection_name Name of the collection
     * @param snapshot_name Snapshot id
     * @returns True if snapshot was deleted
     */
    deleteSnapshot(collection_name: string, snapshot_name: string, args?: {
        wait?: boolean;
    }): Promise<boolean>;
    /**
     * List all snapshots for a whole storage
     * @returns List of snapshots
     */
    listFullSnapshots(): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    }[]>;
    /**
     * Create snapshot for a whole storage
     * @returns Snapshot description
     */
    createFullSnapshot(args?: {
        wait?: boolean;
    }): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    }>;
    /**
     * Delete snapshot for a whole storage
     * @param snapshot_name Snapshot name
     * @returns True if the snapshot was deleted
     */
    deleteFullSnapshot(snapshot_name: string, args?: {
        wait?: boolean;
    }): Promise<boolean>;
    /**
     * Recover collection from snapshot
     * @param collection_name Name of the collection
     * @param {object} args
     *     - location:
     *         URL of the snapshot.
     *         Example:
     *             - URL `http://localhost:8080/collections/my_collection/snapshots/my_snapshot`
     *             - Local path `file:///qdrant/snapshots/test_collection-2022-08-04-10-49-10.snapshot`
     *     - priority:
     *         Defines source of truth for snapshot recovery
     *             - `snapshot` means - prefer snapshot data over the current state
     *             - `replica` means - prefer existing data over the snapshot
     *         Default: `replica`
     *     - checksum:
     *         SHA256 checksum to verify snapshot integrity before recovery
     * @returns True if the snapshot was recovered
     */
    recoverSnapshot(collection_name: string, { location, priority, checksum, api_key }: SchemaFor<'SnapshotRecover'>): Promise<boolean>;
    /**
     * Lock storage for writing
     */
    lockStorage(reason: string): Promise<{
        error_message?: string | null | undefined;
        write: boolean;
    }>;
    /**
     * Unlock storage for writing.
     */
    unlockStorage(): Promise<{
        error_message?: string | null | undefined;
        write: boolean;
    }>;
    /**
     * Get current locks state.
     */
    getLocks(): Promise<{
        error_message?: string | null | undefined;
        write: boolean;
    }>;
    /**
     * Batch update points
     * Apply a series of update operations for points, vectors and payloads.
     * @param collection_name Name of the collection
     * @param {object} args
     *     - wait: Await for the results to be processed.
     *         - If `true`, result will be returned only when all changes are applied
     *         - If `false`, result will be returned immediately after the confirmation of receiving.
     *      - ordering: Define strategy for ordering of the points. Possible values:
     *          - 'weak'   - write operations may be reordered, works faster, default
     *          - 'medium' - write operations go through dynamically selected leader,
     *                      may be inconsistent for a short period of time in case of leader change
     *          - 'strong' - Write operations go through the permanent leader,
     *                      consistent, but may be unavailable if leader is down
     *      - operations: List of operations to perform
     * @returns Operation result
     */
    batchUpdate(collection_name: string, { wait, ordering, ...operations }: {
        wait?: boolean;
        ordering?: SchemaFor<'WriteOrdering'>;
    } & SchemaFor<'UpdateOperations'>): Promise<{
        operation_id?: number | null | undefined;
        status: "acknowledged" | "completed";
    }[]>;
    /**
     * Recover from a snapshot
     * @param collection_name Name of the collection
     * @param shard_id Shard ID
     * @returns Operation result
     */
    recoverShardFromSnapshot(collection_name: string, shard_id: number, { wait, ...shard_snapshot_recover }: {
        wait?: boolean;
    } & SchemaFor<'ShardSnapshotRecover'>): Promise<boolean>;
    /**
     * Get list of snapshots for a shard of a collection
     * @param collection_name Name of the collection
     * @param shard_id Shard ID
     * @returns Operation result
     */
    listShardSnapshots(collection_name: string, shard_id: number): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    }[]>;
    /**
     * Create new snapshot of a shard for a collection
     * @param collection_name Name of the collection
     * @param shard_id Shard ID
     * @returns Operation result
     */
    createShardSnapshot(collection_name: string, shard_id: number, { wait }: {
        wait?: boolean;
    }): Promise<{
        name: string;
        creation_time?: string | null | undefined;
        size: number;
        checksum?: string | null | undefined;
    }>;
    /**
     * Delete snapshot of a shard for a collection
     * @param collection_name Name of the collection
     * @param shard_id Shard ID
     * @param snapshot_name Snapshot name
     * @returns Operation result
     */
    deleteShardSnapshot(collection_name: string, shard_id: number, snapshot_name: string, { wait }: {
        wait?: boolean;
    }): Promise<boolean>;
    /**
     * Create shard key
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - shards_number: How many shards to create for this key If not specified, will use the default value from config
     *     - replication_factor: How many replicas to create for each shard If not specified, will use the default value from config
     *     - placement: Placement of shards for this key List of peer ids, that can be used to place shards for this key If not specified, will be randomly placed among all peers
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @returns Operation result
     */
    createShardKey(collection_name: string, { shard_key, shards_number, replication_factor, placement, timeout, }: {
        timeout?: number;
    } & SchemaFor<'CreateShardingKey'>): Promise<boolean>;
    /**
     * Delete shard key
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     * @returns Operation result
     */
    deleteShardKey(collection_name: string, { shard_key, timeout }: {
        timeout?: number;
    } & SchemaFor<'DropShardingKey'>): Promise<boolean>;
    /**
     * Discover points
     * @description Use context and a target to find the most similar points to the target, constrained by the context.
     * When using only the context (without a target), a special search - called context search - is performed where pairs of points are used to generate a loss that guides the search towards the zone where most positive examples overlap. This means that the score minimizes the scenario of finding a point closer to a negative than to a positive part of a pair.
     * Since the score of a context relates to loss, the maximum score a point can get is 0.0, and it becomes normal that many points can have a score of 0.0.
     * When using target (with or without context), the score behaves a little different: The  integer part of the score represents the rank with respect to the context, while the decimal part of the score relates to the distance to the target. The context part of the score for  each pair is calculated +1 if the point is closer to a positive than to a negative part of a pair,  and -1 otherwise.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
     *     - target: Look for vectors closest to this. When using the target (with or without context), the integer part of the score represents the rank with respect to the context, while the decimal part of the score relates to the distance to the target.
     *     - context: Pairs of { positive, negative } examples to constrain the search. When using only the context (without a target), a special search - called context search - is performed where pairs of points are used to generate a loss that guides the search towards the zone where most positive examples overlap. This means that the score minimizes the scenario of finding a point closer to a negative than to a positive part of a pair. Since the score of a context relates to loss, the maximum score a point can get is 0.0, and it becomes normal that many points can have a score of 0.0. For discovery search (when including a target), the context part of the score for each pair is calculated +1 if the point is closer to a positive than to a negative part of a pair, and -1 otherwise.
     *     - filter: Look only for points which satisfies this conditions
     *     - params: Additional search params
     *     - limit: Max number of result to return
     *     - offset: Offset of the first result to return. May be used to paginate results. Note: large offset values may cause performance issues.
     *     - with_payload: Select which payload to return with the response
     *     - with_vector: Whether to return the point vector with the result?
     *     - using: Define which vector to use for recommendation, if not specified - try to use default vector
     *     - lookup_from The location used to lookup vectors. If not specified - use current collection. Note: the other collection should have the same vector size as the current collection
     * @returns Operation result
     */
    discoverPoints(collection_name: string, { consistency, timeout, shard_key, target, context, params, limit, offset, with_payload, with_vector, using, lookup_from, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'DiscoverRequest'>): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[]>;
    /**
     * Discover batch points
     * @description Look for points based on target and/or positive and negative example pairs, in batch.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - searches: List of searches
     * @returns Operation result
     */
    discoverBatchPoints(collection_name: string, { consistency, timeout, searches, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'DiscoverRequestBatch'>): Promise<{
        id: string | number;
        version: number;
        score: number;
        payload?: Record<string, unknown> | {
            [key: string]: unknown;
        } | null | undefined;
        vector?: Record<string, unknown> | number[] | number[][] | {
            [key: string]: number[] | number[][] | {
                indices: number[];
                values: number[];
            } | undefined;
        } | null | undefined;
        shard_key?: string | number | Record<string, unknown> | null | undefined;
        order_value?: number | Record<string, unknown> | null | undefined;
    }[][]>;
    /**
     * Returns information about the running Qdrant instance
     * @description Returns information about the running Qdrant instance like version and commit id
     * @returns Operation result
     */
    versionInfo(): Promise<{
        title: string;
        version: string;
        commit?: string | null | undefined;
    }>;
    /**
     * Check the existence of a collection
     * @param collection_name Name of the collection
     * @description Returns "true" if the given collection name exists, and "false" otherwise
     * @returns Operation result
     */
    collectionExists(collection_name: string): Promise<{
        exists: boolean;
    }>;
    /**
     * Query points
     * @description Universally query points. This endpoint covers all capabilities of search, recommend, discover, filters. But also enables hybrid and multi-stage queries.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards.
     *     - prefetch: Sub-requests to perform first. If present, the query will be performed on the results of the prefetch(es).
     *     - query: Query to perform. If missing without prefetches, returns points ordered by their IDs.
     *     - using: Define which vector name to use for querying. If missing, the default vector is used.
     *     - filter: Filter conditions - return only those points that satisfy the specified conditions.
     *     - params: Search params for when there is no prefetch
     *     - score_threshold: Return points with scores better than this threshold.
     *     - limit: Max number of points to return. Default is 10.
     *     - offset: Offset of the result. Skip this many points. Default is 0
     *     - with_vector: Options for specifying which vectors to include into the response. Default is false.
     *     - with_payload: Options for specifying which payload to include or not. Default is false.
     *     - lookup_from: The location to use for IDs lookup, if not specified - use the current collection and the 'using' vector Note: the other collection vectors should have the same vector size as the 'using' vector in the current collection.
     * @returns Operation result
     */
    query(collection_name: string, { consistency, timeout, shard_key, prefetch, query, using, filter, params, score_threshold, limit, offset, with_vector, with_payload, lookup_from, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'QueryRequest'>): Promise<{
        points: {
            id: string | number;
            version: number;
            score: number;
            payload?: Record<string, unknown> | {
                [key: string]: unknown;
            } | null | undefined;
            vector?: Record<string, unknown> | number[] | number[][] | {
                [key: string]: number[] | number[][] | {
                    indices: number[];
                    values: number[];
                } | undefined;
            } | null | undefined;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
            order_value?: number | Record<string, unknown> | null | undefined;
        }[];
    }>;
    /**
     * Query points in batch
     * @description Universally query points in batch. This endpoint covers all capabilities of search, recommend, discover, filters. But also enables hybrid and multi-stage queries.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - searches: List of queries
     * @returns Operation result
     */
    queryBatch(collection_name: string, { consistency, timeout, searches, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'QueryRequestBatch'>): Promise<{
        points: {
            id: string | number;
            version: number;
            score: number;
            payload?: Record<string, unknown> | {
                [key: string]: unknown;
            } | null | undefined;
            vector?: Record<string, unknown> | number[] | number[][] | {
                [key: string]: number[] | number[][] | {
                    indices: number[];
                    values: number[];
                } | undefined;
            } | null | undefined;
            shard_key?: string | number | Record<string, unknown> | null | undefined;
            order_value?: number | Record<string, unknown> | null | undefined;
        }[];
    }[]>;
    /**
     * Query points, grouped by a given payload field
     * @description Universally query points, grouped by a given payload field
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards.
     *     - prefetch: Sub-requests to perform first. If present, the query will be performed on the results of the prefetch(es).
     *     - query: Query to perform. If missing without prefetches, returns points ordered by their IDs.
     *     - using: Define which vector name to use for querying. If missing, the default vector is used.
     *     - filter: Filter conditions - return only those points that satisfy the specified conditions.
     *     - params: Search params for when there is no prefetch
     *     - score_threshold: Return points with scores better than this threshold.
     *     - with_vector: Options for specifying which vectors to include into the response. Default is false.
     *     - with_payload: Options for specifying which payload to include or not. Default is false.
     *     - group_by: Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups.
     *     - group_size: Maximum amount of points to return per group. Default is 3.
     *     - limit: Maximum amount of groups to return. Default is 10.
     *     - with_lookup: Look for points in another collection using the group ids.
     * @returns Operation result
     */
    queryGroups(collection_name: string, { consistency, timeout, shard_key, prefetch, query, using, filter, params, score_threshold, with_vector, with_payload, group_by, group_size, limit, with_lookup, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'QueryGroupsRequest'>): Promise<{
        groups: {
            hits: {
                id: string | number;
                version: number;
                score: number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            }[];
            id: string | number;
            lookup?: Record<string, unknown> | {
                id: string | number;
                payload?: Record<string, unknown> | {
                    [key: string]: unknown;
                } | null | undefined;
                vector?: Record<string, unknown> | number[] | number[][] | {
                    [key: string]: number[] | number[][] | {
                        indices: number[];
                        values: number[];
                    } | undefined;
                } | null | undefined;
                shard_key?: string | number | Record<string, unknown> | null | undefined;
                order_value?: number | Record<string, unknown> | null | undefined;
            } | null | undefined;
        }[];
    }>;
    /**
     * Facet a payload key with a given filter.
     * @description Count points that satisfy the given filter for each unique value of a payload key.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards.
     *     - key: Payload key to use for faceting.
     *     - limit: Max number of hits to return. Default is 10.
     *     - filter: Filter conditions - only consider points that satisfy these conditions.
     *     - exact: Whether to do a more expensive exact count for each of the values in the facet. Default is false.
     * @returns Operation result
     */
    facet(collection_name: string, { consistency, timeout, shard_key, key, limit, filter, exact, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'FacetRequest'>): Promise<{
        hits: {
            value: string | number | boolean;
            count: number;
        }[];
    }>;
    /**
     * Search points matrix distance pairs.
     * @description Compute distance matrix for sampled points with a pair based output format.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards.
     *     - filter: Look only for points which satisfies this conditions.
     *     - sample: How many points to select and search within. Default is 10.
     *     - limit: How many neighbours per sample to find. Default is 3.
     *     - using: Define which vector name to use for querying. If missing, the default vector is used.
     * @returns Operation result
     */
    searchMatrixPairs(collection_name: string, { consistency, timeout, shard_key, filter, sample, limit, using, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'SearchMatrixRequest'>): Promise<{
        pairs: {
            a: string | number;
            b: string | number;
            score: number;
        }[];
    }>;
    /**
     * Search points matrix distance offsets.
     * @description Compute distance matrix for sampled points with an offset based output format.
     * @param collection_name Name of the collection
     * @param {object} args -
     *     - consistency: Read consistency of the search. Defines how many replicas should be queried before returning the result.
     *         Values:
     *             number - number of replicas to query, values should present in all queried replicas
     *             'majority' - query all replicas, but return values present in the majority of replicas
     *             'quorum' - query the majority of replicas, return values present in all of them
     *             'all' - query all replicas, and return values present in all replicas
     *     - timeout: If set, overrides global timeout setting for this request. Unit is seconds.
     *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards.
     *     - filter: Look only for points which satisfies this conditions.
     *     - sample: How many points to select and search within. Default is 10.
     *     - limit: How many neighbours per sample to find. Default is 3.
     *     - using: Define which vector name to use for querying. If missing, the default vector is used.
     * @returns Operation result
     */
    searchMatrixOffsets(collection_name: string, { consistency, timeout, shard_key, filter, sample, limit, using, }: {
        consistency?: SchemaFor<'ReadConsistency'>;
    } & {
        timeout?: number;
    } & SchemaFor<'SearchMatrixRequest'>): Promise<{
        offsets_row: number[];
        offsets_col: number[];
        scores: number[];
        ids: (string | number)[];
    }>;
}
