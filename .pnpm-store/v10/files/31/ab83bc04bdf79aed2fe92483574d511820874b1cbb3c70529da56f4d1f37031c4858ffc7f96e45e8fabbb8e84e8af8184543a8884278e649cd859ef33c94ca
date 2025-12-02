type CacheSetting = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload" | false;
type UpstashRequest = {
    path?: string[];
    /**
     * Request body will be serialized to json
     */
    body?: unknown;
};
type UpstashResponse<TResult> = {
    result?: TResult;
    error?: string;
};
type Requester = {
    request: <TResult = unknown>(req: UpstashRequest) => Promise<UpstashResponse<TResult>>;
};
type RetryConfig = false | {
    /**
     * The number of retries to attempt before giving up.
     *
     * @default 5
     */
    retries?: number;
    /**
     * A backoff function receives the current retry cound and returns a number in milliseconds to wait before retrying.
     *
     * @default
     * ```ts
     * Math.exp(retryCount) * 50
     * ```
     */
    backoff?: (retryCount: number) => number;
};
type RequesterConfig = {
    /**
     * Configure the retry behaviour in case of network errors
     */
    retry?: RetryConfig;
    /**
     * Configure the cache behaviour
     * @default "no-store"
     */
    cache?: CacheSetting;
};
type HttpClientConfig = {
    headers?: Record<string, string>;
    baseUrl: string;
    retry?: RetryConfig;
    signal?: AbortSignal | (() => AbortSignal);
} & RequesterConfig;

type Vector<TMetadata = Dict> = {
    id: string;
    vector?: number[];
    sparseVector?: SparseVector;
    metadata?: TMetadata;
    data?: string;
};
type NAMESPACE = string;
type Dict = Record<string, unknown>;
type SparseVector = {
    indices: number[];
    values: number[];
};

declare const _ENDPOINTS: readonly ["upsert", "update", "query", "delete", "fetch", "reset", "range", "info", "resumable-query", "resumable-query-data", "resumable-query-next", "resumable-query-end", "upsert-data", "query-data", "list-namespaces", "delete-namespace"];
type EndpointVariants = (typeof _ENDPOINTS)[number] | `${(typeof _ENDPOINTS)[number]}/${NAMESPACE}` | `reset?all`;
/**
 * TResult is the raw data returned from upstash, which may need to be transformed or parsed.
 */
declare class Command<TResult> {
    readonly payload: Dict | unknown[];
    readonly endpoint: EndpointVariants;
    constructor(command: Dict | unknown[], endpoint: EndpointVariants);
    /**
     * Execute the command using a client.
     */
    exec(client: Requester): Promise<TResult>;
}

type IdsPayload = (number[] | string[]) | number | string;
type ObjectPayload = {
    ids: number[] | string[];
} | {
    prefix: string;
} | {
    filter: string;
};
type DeleteCommandPayload = IdsPayload | ObjectPayload;

declare class DeleteCommand extends Command<{
    deleted: number;
}> {
    constructor(payload: DeleteCommandPayload, options?: {
        namespace?: string;
    });
}

type QueryCommandPayload = {
    topK: number;
    filter?: string;
    includeVectors?: boolean;
    includeMetadata?: boolean;
    includeData?: boolean;
    weightingStrategy?: WeightingStrategy;
    fusionAlgorithm?: FusionAlgorithm;
    queryMode?: QueryMode;
} & ({
    vector: number[];
    sparseVector?: SparseVector;
    data?: never;
} | {
    vector?: number[];
    sparseVector: SparseVector;
    data?: never;
} | {
    data: string;
    vector?: never;
    sparseVector?: never;
});
type QueryResult<TMetadata = Dict> = {
    id: number | string;
    score: number;
    vector?: number[];
    sparseVector?: SparseVector;
    metadata?: TMetadata;
    data?: string;
};
type QueryCommandOptions = {
    namespace?: string;
};
/**
 * For sparse vectors, what kind of weighting strategy
 * should be used while querying the matching non-zero
 * dimension values of the query vector with the documents.
 *
 * If not provided, no weighting will be used.
 */
declare enum WeightingStrategy {
    /**
     * Inverse document frequency.
     *
     * It is recommended to use this weighting strategy for
     * BM25 sparse embedding models.
     *
     * It is calculated as
     *
     * ln(((N - n(q) + 0.5) / (n(q) + 0.5)) + 1) where
     * N:    Total number of sparse vectors.
     * n(q): Total number of sparse vectors having non-zero value
     *       for that particular dimension.
     * ln:   Natural logarithm
     *
     * The values of N and n(q) are maintained by Upstash as the
     * vectors are indexed.
     */
    IDF = "IDF"
}
/**
 * Fusion algorithm to use while fusing scores
 * from dense and sparse components of a hybrid index.
 *
 * If not provided, defaults to `RRF`.
 */
declare enum FusionAlgorithm {
    /**
     * Reciprocal rank fusion.
     *
     * Each sorted score from the dense and sparse indexes are
     * mapped to 1 / (rank + K), where rank is the order of the
     * score in the dense or sparse scores and K is a constant
     * with the value of 60.
     *
     * Then, scores from the dense and sparse components are
     * deduplicated (i.e. if a score for the same vector is present
     * in both dense and sparse scores, the mapped scores are
     * added; otherwise individual mapped scores are used)
     * and the final result is returned as the topK values
     * of this final list.
     *
     * In short, this algorithm just takes the order of the scores
     * into consideration.
     */
    RRF = "RRF",
    /**
     * Distribution based score fusion.
     *
     * Each sorted score from the dense and sparse indexes are
     * normalized as
     * (s - (mean - 3 * stddev)) / ((mean + 3 * stddev) - (mean - 3 * stddev))
     * where s is the score, (mean - 3 * stddev) is the minimum,
     * and (mean + 3 * stddev) is the maximum tail ends of the distribution.
     *
     * Then, scores from the dense and sparse components are
     * deduplicated (i.e. if a score for the same vector is present
     * in both dense and sparse scores, the normalized scores are
     * added; otherwise individual normalized scores are used)
     * and the final result is returned as the topK values
     * of this final list.
     *
     * In short, this algorithm takes distribution of the scores
     * into consideration as well, as opposed to the `RRF`.
     */
    DBSF = "DBSF"
}
/**
 * Query mode for hybrid indexes with Upstash-hosted
 * embedding models.
 *
 * Specifies whether to run the query in only the
 * dense index, only the sparse index, or in both.
 *
 * If not provided, defaults to `HYBRID`.
 */
declare enum QueryMode {
    /**
     * Runs the query in hybrid index mode, after embedding
     * the raw text data into dense and sparse vectors.
     *
     * Query results from the dense and sparse index components
     * of the hybrid index are fused before returning the result.
     */
    HYBRID = "HYBRID",
    /**
     * Runs the query in dense index mode, after embedding
     * the raw text data into a dense vector.
     *
     * Only the query results from the dense index component
     * of the hybrid index is returned.
     */
    DENSE = "DENSE",
    /**
     * Runs the query in sparse index mode, after embedding
     * the raw text data into a sparse vector.
     *
     * Only the query results from the sparse index component
     * of the hybrid index is returned.
     */
    SPARSE = "SPARSE"
}

declare class QueryManyCommand<TMetadata> extends Command<QueryResult<TMetadata>[][]> {
    constructor(payload: QueryCommandPayload[], options?: QueryCommandOptions);
}

declare class QueryCommand<TMetadata> extends Command<QueryResult<TMetadata>[]> {
    constructor(payload: QueryCommandPayload, options?: QueryCommandOptions);
}

type FetchResult<TMetadata = Dict> = Vector<TMetadata> | null;

type RangeCommandPayload = {
    cursor: number | string;
    limit: number;
    includeVectors?: boolean;
    includeMetadata?: boolean;
    includeData?: boolean;
    prefix?: string;
};
type RangeCommandOptions = {
    namespace?: string;
};
type RangeResult<TMetadata = Dict> = {
    nextCursor: string;
    vectors: Vector<TMetadata>[];
};
declare class RangeCommand<TMetadata> extends Command<RangeResult<TMetadata>> {
    constructor(payload: RangeCommandPayload, options?: RangeCommandOptions);
}

type ResetCommandOptions = {
    namespace?: string;
    all?: never;
} | {
    namespace?: never;
    all?: true;
};

type NamespaceTitle = string;
type SimilarityFunction = "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";
type NamespaceInfo = {
    vectorCount: number;
    pendingVectorCount: number;
};
type DenseIndexInfo = {
    dimension: number;
    similarityFunction: SimilarityFunction;
    embeddingModel?: string;
};
type SparseIndexInfo = {
    embeddingModel?: string;
};
type InfoResult = {
    vectorCount: number;
    pendingVectorCount: number;
    indexSize: number;
    dimension: number;
    similarityFunction: SimilarityFunction;
    denseIndex?: DenseIndexInfo;
    sparseIndex?: SparseIndexInfo;
    namespaces: Record<NamespaceTitle, NamespaceInfo>;
};

type ResumableQueryPayload = {
    maxIdle: number;
} & QueryCommandPayload;

declare class Namespace<TIndexMetadata extends Dict = Dict> {
    protected client: Requester;
    protected namespace: string;
    /**
     * Create a new index namespace client
     *
     * @example
     * ```typescript
     * const index = new Index({
     *  url: "<UPSTASH_VECTOR_REST_URL>",
     *  token: "<UPSTASH_VECTOR_REST_TOKEN>",
     * });
     *
     * const namespace = index.namespace("ns");
     * ```
     */
    constructor(client: Requester, namespace: string);
    /**
     * Upserts (Updates and Inserts) specific items into the index namespace.
     * It's used for adding new items to the index namespace or updating existing ones.
     *
     * @example
     * ```js
     * const upsertArgs = {
     *   id: '123',
     *   vector: [0.42, 0.87, ...],
     *   metadata: { property1: 'value1', property2: 'value2' }
     * };
     * const upsertResult = await index.namespace("ns").upsert(upsertArgs);
     * console.log(upsertResult); // Outputs the result of the upsert operation
     * ```
     *
     * @param {CommandArgs<typeof UpsertCommand>} args - The arguments for the upsert command.
     * @param {number|string} args.id - The unique identifier for the item being upserted.
     * @param {number[]} args.vector - The feature vector associated with the item.
     * @param {Dict} [args.metadata] - Optional metadata to be associated with the item.
     *
     * @returns {string} A promise that resolves with the result of the upsert operation after the command is executed.
     */
    upsert: <TMetadata extends Dict = TIndexMetadata>(args: ({
        id: string | number;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } & ({
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    })) | {
        id: string | number;
        data: string;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } | ({
        id: string | number;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } & ({
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    }))[] | {
        id: string | number;
        data: string;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    }[]) => Promise<string>;
    update: <TMetadata extends Dict = TIndexMetadata>(args: ({
        id: string | number;
    } & ({
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    })) | {
        id: string | number;
        data: string;
    } | {
        id: string | number;
        metadata: TMetadata extends infer U ? U : never;
        metadataUpdateMode?: "PATCH" | "OVERWRITE" | undefined;
    }) => Promise<{
        updated: number;
    }>;
    /**
     * Fetches specific items from the index by their IDs or by an id prefix.
     *
     * Note: While using id prefix, the paginated `range` command is recommended to prevent timeouts on large result sets.
     *
     * @example
     * ```js
     * // Using ids
     * await index.namespace("ns").fetch(["test-1", "test-2"], { includeMetadata: true });
     *
     * // Using id prefix
     * await index.namespace("ns").fetch({ prefix: "test-" });
     * ```
     *
     * @param {...CommandArgs<typeof FetchCommand>} args - The arguments for the fetch command.
     * @param {FetchPayload} args[0] - An array of IDs or the id prefix of the items to be fetched.
     * @param {FetchCommandOptions} args[1] - Options for the fetch operation.
     * @param {boolean} [args[1].includeMetadata=false] - Optionally include metadata of the fetched items.
     * @param {boolean} [args[1].includeVectors=false] - Optionally include feature vectors of the fetched items.
     * @param {string} [args[1].namespace = ""] - The namespace of the index to fetch items from.
     *
     * @returns {Promise<FetchReturnResponse<TMetadata>[]>} A promise that resolves with an array of fetched items or null if not found, after the command is executed.
     */
    fetch: <TMetadata extends Dict = TIndexMetadata>(payload: (number[] | string[]) | ({
        ids: number[] | string[];
    } | {
        prefix: string;
    }), opts?: {
        includeMetadata?: boolean | undefined;
        includeVectors?: boolean | undefined;
        includeData?: boolean | undefined;
        namespace?: string | undefined;
    } | undefined) => Promise<FetchResult<TMetadata>[]>;
    /**
     * Queries an index namespace with specified parameters.
     * This method creates and executes a query command on an index based on the provided arguments.
     *
     * @example
     * ```js
     * await index.namespace("ns").query({
     *  topK: 3,
     *  vector: [ 0.22, 0.66 ],
     *  filter: "age >= 23 and (type = \'turtle\' OR type = \'cat\')"
     * });
     * ```
     *
     * @param {Object} args - The arguments for the query command.
     * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
     *                                This vector is utilized to find the most relevant items in the index.
     * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
     * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
     * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
     * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
     *
     * @returns A promise that resolves with an array of query result objects when the request to query the index is completed.
     */
    query: <TMetadata extends Dict = TIndexMetadata>(args: CommandArgs<typeof QueryCommand>) => Promise<QueryResult<TMetadata>[]>;
    /**
     * Initializes a resumable query operation on the vector database.
     * This method allows for querying large result sets in multiple chunks or implementing pagination.
     *
     * @template TMetadata
     * @param {ResumableQueryPayload} args - The arguments for the resumable query.
     * @param {number} args.maxIdle - The maximum idle time in seconds before the query session expires.
     * @param {number} args.topK - The number of top results to return in each fetch operation.
     * @param {number[]} args.vector - The query vector used for similarity search.
     * @param {boolean} [args.includeMetadata] - Whether to include metadata in the query results.
     * @param {boolean} [args.includeVectors] - Whether to include vectors in the query results.
     * @param {Object} [options] - Additional options for the query.
     * @returns {Promise<ResumableQuery<TMetadata>>} A promise that resolves to a ResumableQuery object.
     * @example
     * const { result, fetchNext, stop } = await index.namespace("ns").resumableQuery({
     *   maxIdle: 3600,
     *   topK: 50,
     *   vector: [0.1, 0.2, 0.3, ...],
     *   includeMetadata: true,
     *   includeVectors: true
     * }, { namespace: 'my-namespace' });
     *
     * const firstBatch = await fetchNext(10);
     * const secondBatch = await fetchNext(10);
     * await stop(); // End the query session
     */
    resumableQuery: <TMetadata extends Dict = TIndexMetadata>(args: ResumableQueryPayload) => Promise<{
        fetchNext: (additionalK: number) => Promise<QueryResult[]>;
        stop: () => Promise<string>;
        result: QueryResult<TMetadata>[];
    }>;
    /**
     * Deletes items from the index namespace by id, by id prefix, or by filter.
     *
     * @example
     * ```js
     * // Delete by id
     * await index.namespace("ns").delete("test-id");
  
     * // Delete by ids
     * await index.namespace("ns").delete(["test-id1", "test-id2"]);
  
     * // Delete by id prefix
     * await index.namespace("ns").delete({ prefix: "test-" });
  
     * // Delete by filter
     * await index.namespace("ns").delete({ filter: "age >= 23" });
     * ```
     *
     * @param args - A single id, an array of ids, a prefix, or a filter to delete items from the index.
     * @returns Number of deleted vectors in the format `{ deleted: number }`.If no vectors are deleted, returns `{ deleted: 0 }`.
     */
    delete: (args: CommandArgs<typeof DeleteCommand>) => Promise<{
        deleted: number;
    }>;
    /**
     * Retrieves a paginated range of items from the index. Optionally filter results by an id prefix.
     * Returns items in batches with a cursor for pagination.
     *
     * @example
     * ```js
     * const args = {
     *   limit: 10,
     *   includeVectors: true,
     *   includeMetadata: false
     * };
     * await index.namespace("ns").range(args);
     *
     * // Use the cursor to get the next page of results
     * const nextPage = await index.namespace("ns").range({
     *   // You have to pass the arguments from the first call
     *   ...args,
     *   cursor: rangeResult.nextCursor,
     * });
     * ```
     *
     * @param {CommandArgs<typeof RangeCommand>} args - The arguments for the range command.
     * @param {string} [args.prefix] - The prefix of the items to be fetched.
     * @param {number|string} args.cursor - The starting point (cursor) for the range query.
     * @param {number} args.limit - The maximum number of items to return in this range.
     * @param {boolean} [args.includeVectors=false] - Optionally include the feature vectors of the items in the response.
     * @param {boolean} [args.includeMetadata=false] - Optionally include additional metadata of the items in the response.
     *
     * @returns {Promise<RangeReturnResponse<TMetadata>>} A promise that resolves with the response containing the next cursor and an array of vectors, after the command is executed.
     */
    range: <TMetadata extends Dict = TIndexMetadata>(args: CommandArgs<typeof RangeCommand>) => Promise<RangeResult<TMetadata>>;
    /**
     * It's used for wiping all the vectors in a index namespace.
     *
     * @example
     * ```js
     * await index.namespace("ns").reset();
     * console.log('Index namespace has been reset');
     * ```
     *
     * @returns {Promise<string>} A promise that resolves with the result of the reset operation after the command is executed.
     */
    reset: () => Promise<string>;
}

type CommandArgs<TCommand extends new (_args: any) => any> = ConstructorParameters<TCommand>[0];
/**
 * Serverless vector client for upstash vector db.
 */
declare class Index<TIndexMetadata extends Dict = Dict> {
    protected client: Requester;
    /**
     * Create a new vector db client
     *
     * @example
     * ```typescript
     * const index = new Index({
     *  url: "<UPSTASH_VECTOR_REST_URL>",
     *  token: "<UPSTASH_VECTOR_REST_TOKEN>",
     * });
     * ```
     */
    constructor(client: Requester);
    namespace: (namespace: string) => Namespace<TIndexMetadata>;
    /**
     * Deletes items from the index by id, by id prefix, or by filter.
     *
     * @example
     * ```js
     * // Delete by id
     * await index.delete("test-id");
  
     * // Delete by ids
     * await index.delete(["test-id1", "test-id2"]);
  
     * // Delete by id prefix
     * await index.delete({ prefix: "test-" });
  
     * // Delete by filter
     * await index.delete({ filter: "age >= 23" });
     * ```
     *
     * @param args - A single id, an array of ids, a prefix, or a filter to delete items from the index.
     * @returns Number of deleted vectors in the format `{ deleted: number }`.If no vectors are deleted, returns `{ deleted: 0 }`.
     */
    delete: (args: CommandArgs<typeof DeleteCommand>, options?: {
        namespace?: string;
    }) => Promise<{
        deleted: number;
    }>;
    /**
     * Queries an index with specified parameters.
     * This method creates and executes a query command on an index based on the provided arguments.
     *
     * @example
     * ```js
     * await index.query({
     *  topK: 3,
     *  vector: [ 0.22, 0.66 ],
     *  filter: "age >= 23 and (type = \'turtle\' OR type = \'cat\')"
     * });
     * ```
     *
     * @param {Object} args - The arguments for the query command.
     * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
     *                                This vector is utilized to find the most relevant items in the index.
     * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
     * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
     * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
     * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
     * @param {boolean} [args.includeData=false] - When set to true, includes data - string - of the returned items in the response.
     *
     *  A promise that resolves with an array of query result objects when the request to query the index is completed.
     */
    query: <TMetadata extends Dict = TIndexMetadata>(args: CommandArgs<typeof QueryCommand>, options?: {
        namespace?: string;
    }) => Promise<QueryResult<TMetadata>[]>;
    /**
     * Queries an index with specified parameters.
     * This method creates and executes a query command on an index based on the provided arguments.
     *
     * @example
     * ```js
     * await index.queryMany([
     * {
     *     topK: 3,
     *     vector: [0.22, 0.66],
     *     filter: "age >= 23 and (type = 'turtle' OR type = 'cat')",
     * },
     * {
     *     topK: 3,
     *     vector: [0.45, 0.52],
     *     filter: "age >= 27 and (type = 'rabbit' OR type = 'dog')",
     * },
     * ]);
     *
     * ```
     *
     * @param {Object} args - The arguments for the query command.
     * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
     *                                This vector is utilized to find the most relevant items in the index.
     * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
     * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
     * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
     * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
     * @param {boolean} [args.includeData=false] - When set to true, includes data - string - of the returned items in the response.
     *
     *  A promise that resolves with an array of arrays of query result objects,
     *  where each inner array represents a group of results matching a specific query condition.
     */
    queryMany: <TMetadata extends Dict = TIndexMetadata>(args: CommandArgs<typeof QueryManyCommand>, options?: {
        namespace?: string;
    }) => Promise<QueryResult<TMetadata>[][]>;
    /**
     * Initializes a resumable query operation on the vector database.
     * This method allows for querying large result sets in multiple chunks or implementing pagination.
     *
     * @template TMetadata
     * @param {ResumableQueryPayload} args - The arguments for the resumable query.
     * @param {number} args.maxIdle - The maximum idle time in seconds before the query session expires.
     * @param {number} args.topK - The number of top results to return in each fetch operation.
     * @param {number[]} args.vector - The query vector used for similarity search.
     * @param {boolean} [args.includeMetadata] - Whether to include metadata in the query results.
     * @param {boolean} [args.includeVectors] - Whether to include vectors in the query results.
     * @param {Object} [options] - Additional options for the query.
     * @param {string} [options.namespace] - The namespace to query within.
     * @returns {Promise<ResumableQuery<TMetadata>>} A promise that resolves to a ResumableQuery object.
     * @example
     * const { result, fetchNext, stop } = await index.resumableQuery({
     *   maxIdle: 3600,
     *   topK: 50,
     *   vector: [0.1, 0.2, 0.3, ...],
     *   includeMetadata: true,
     *   includeVectors: true
     * }, { namespace: 'my-namespace' });
     *
     * const firstBatch = await fetchNext(10);
     * const secondBatch = await fetchNext(10);
     * await stop(); // End the query session
     */
    resumableQuery: <TMetadata extends Dict = TIndexMetadata>(args: ResumableQueryPayload, options?: {
        namespace?: string;
    }) => Promise<{
        fetchNext: (additionalK: number) => Promise<QueryResult[]>;
        stop: () => Promise<string>;
        result: QueryResult<TMetadata>[];
    }>;
    /**
     * Upserts (Updates and Inserts) specific items into the index.
     * It's used for adding new items to the index or updating existing ones.
     *
     * @example
     * ```js
     * const upsertArgs = {
     *   id: '123',
     *   vector: [0.42, 0.87, ...],
     *   metadata: { property1: 'value1', property2: 'value2' }
     * };
     * const upsertResult = await index.upsert(upsertArgs);
     * console.log(upsertResult); // Outputs the result of the upsert operation
     * ```
     *
     * @param {CommandArgs<typeof UpsertCommand>} args - The arguments for the upsert command.
     * @param {number|string} args.id - The unique identifier for the item being upserted.
     * @param {number[]} args.vector - The feature vector associated with the item.
     * @param {Record<string, unknown>} [args.metadata] - Optional metadata to be associated with the item.
     *
     * @returns {string} A promise that resolves with the result of the upsert operation after the command is executed.
     */
    upsert: <TMetadata extends Dict = TIndexMetadata>(args: ({
        id: string | number;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } & ({
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    })) | {
        id: string | number;
        data: string;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } | ({
        id: string | number;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    } & ({
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    }))[] | {
        id: string | number;
        data: string;
        metadata?: (TMetadata extends infer U ? U : never) | undefined;
    }[], options?: {
        namespace?: string;
    }) => Promise<string>;
    update: <TMetadata extends Dict = TIndexMetadata>(args: ({
        id: string | number;
    } & ({
        vector?: number[] | undefined;
        sparseVector: SparseVector;
    } | {
        vector: number[];
        sparseVector?: SparseVector | undefined;
    } | {
        vector: number[];
        sparseVector: SparseVector;
    })) | {
        id: string | number;
        data: string;
    } | {
        id: string | number;
        metadata: TMetadata extends infer U ? U : never;
        metadataUpdateMode?: "PATCH" | "OVERWRITE" | undefined;
    }, options?: {
        namespace?: string;
    }) => Promise<{
        updated: number;
    }>;
    /**
     * Fetches specific items from the index by their IDs or by an id prefix.
     *
     * Note: While using id prefix, the paginated `range` command is recommended to prevent timeouts on large result sets.
     *
     * @example
     * ```js
     * // Using ids
     * await index.fetch(["test-1", "test-2"], { includeMetadata: true });
     *
     * // Using id prefix
     * await index.fetch({ prefix: "test-" });
     * ```
     *
     * @param {...CommandArgs<typeof FetchCommand>} args - The arguments for the fetch command.
     * @param {FetchPayload} args[0] - An array of IDs or the id prefix of the items to be fetched.
     * @param {FetchCommandOptions} args[1] - Options for the fetch operation.
     * @param {boolean} [args[1].includeMetadata=false] - Optionally include metadata of the fetched items.
     * @param {boolean} [args[1].includeVectors=false] - Optionally include feature vectors of the fetched items.
     * @param {string} [args[1].namespace = ""] - The namespace of the index to fetch items from.
     *
     * @returns {Promise<FetchReturnResponse<TMetadata>[]>} A promise that resolves with an array of fetched items or null if not found, after the command is executed.
     */
    fetch: <TMetadata extends Dict = TIndexMetadata>(payload: (number[] | string[]) | ({
        ids: number[] | string[];
    } | {
        prefix: string;
    }), opts?: {
        includeMetadata?: boolean | undefined;
        includeVectors?: boolean | undefined;
        includeData?: boolean | undefined;
        namespace?: string | undefined;
    } | undefined) => Promise<FetchResult<TMetadata>[]>;
    /**
     * It's used for wiping the index.
     *
     * By default, resets the default namespace:
     *
     * @example
     * ```js
     * await index.reset();
     * console.log('Default namespace has been reset');
     * ```
     *
     * To reset a namespace, call reset like:
     *
     * @example
     * ```js
     * await index.reset({ namespace: "ns" });
     * console.log('Namespace ns has been reset');
     * ```
     *
     * If you want to reset all namespaces, call reset like:
     *
     * @example
     * ```js
     * await index.reset({ all: true });
     * console.log('All namespaces have been reset');
     * ```
     *
     * @returns {Promise<string>} A promise that resolves with the result of the reset operation after the command is executed.
     */
    reset: (options?: ResetCommandOptions) => Promise<string>;
    /**
     * Retrieves a paginated range of items from the index. Optionally filter results by an id prefix.
     * Returns items in batches with a cursor for pagination.
     *
     * @example
     * ```js
     * const args = {
     *   limit: 10,
     *   includeVectors: true,
     *   includeMetadata: false
     * };
     * await index.range(args);
     *
     * // Use the cursor to get the next page of results
     * const nextPage = await index.range({
     *   // You have to pass the arguments from the first call
     *   ...args,
     *   cursor: rangeResult.nextCursor,
     * });
     * ```
     *
     * @param {CommandArgs<typeof RangeCommand>} args - The arguments for the range command.
     * @param {string} [args.prefix] - The prefix of the items to be fetched.
     * @param {number|string} args.cursor - The starting point (cursor) for the range query.
     * @param {number} args.limit - The maximum number of items to return in this range.
     * @param {boolean} [args.includeVectors=false] - Optionally include the feature vectors of the items in the response.
     * @param {boolean} [args.includeMetadata=false] - Optionally include additional metadata of the items in the response.
     *
     * @returns {Promise<RangeReturnResponse<TMetadata>>} A promise that resolves with the response containing the next cursor and an array of vectors, after the command is executed.
     */
    range: <TMetadata extends Dict = TIndexMetadata>(args: CommandArgs<typeof RangeCommand>, options?: {
        namespace?: string;
    }) => Promise<RangeResult<TMetadata>>;
    /**
     * Retrieves info from the index.
     *
     * @example
     * ```js
     * const infoResults = await index.info();
     * console.log(infoResults); // Outputs the result of the info operation
     * ```
     *
     * @returns {Promise<InfoResult>} A promise that resolves with the response containing the vectorCount, pendingVectorCount, indexSize, dimension count and similarity algorithm after the command is executed.
     */
    info: () => Promise<InfoResult>;
    /**
     * List all namespaces in the vector database.
     *
     * @example
     * ```js
     * const namespaces = await index.listNamespaces();
     * console.log(namespaces); // Outputs the list of namespaces
     * ```
     *
     * @returns {Promise<string[]>} A promise that resolves with an array of namespaces after the command is executed.
     */
    listNamespaces: () => Promise<string[]>;
    /**
     * Deletes a namespace from the vector database.
     *
     * @example
     * ```js
     * await index.deleteNamespace('namespace');
     * console.log('Namespace has been deleted');
     * ```
     *
     * @param {string} namespace - The name of the namespace to be deleted.
     * @returns {Promise<string>} A promise that resolves with the result of the delete operation after the command is executed.
     */
    deleteNamespace: (namespace: string) => Promise<string>;
}

export { type Dict as D, FusionAlgorithm as F, type HttpClientConfig as H, Index as I, QueryMode as Q, type RequesterConfig as R, type SparseVector as S, type UpstashRequest as U, type Vector as V, WeightingStrategy as W, type Requester as a, type UpstashResponse as b, type RangeResult as c, type FetchResult as d, type QueryResult as e, type InfoResult as f };
