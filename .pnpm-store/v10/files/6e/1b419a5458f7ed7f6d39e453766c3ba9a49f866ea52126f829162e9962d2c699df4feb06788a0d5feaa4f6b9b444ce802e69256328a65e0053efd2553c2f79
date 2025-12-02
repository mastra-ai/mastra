"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const fetch_1 = require("./fetch");
const helpers_1 = require("./helpers");
/**
 * API class for managing Vector Data within Vector Indexes
 * Provides methods for inserting, querying, listing, and deleting vector embeddings
 */
class VectorDataApi {
    constructor(url, headers = {}, fetch) {
        this.shouldThrowOnError = false;
        this.url = url.replace(/\/$/, '');
        this.headers = Object.assign(Object.assign({}, constants_1.DEFAULT_HEADERS), headers);
        this.fetch = (0, helpers_1.resolveFetch)(fetch);
    }
    /**
     * Enable throwing errors instead of returning them in the response
     * When enabled, failed operations will throw instead of returning { data: null, error }
     *
     * @returns This instance for method chaining
     * @example
     * ```typescript
     * const client = new VectorDataApi(url, headers)
     * client.throwOnError()
     * const { data } = await client.putVectors(options) // throws on error
     * ```
     */
    throwOnError() {
        this.shouldThrowOnError = true;
        return this;
    }
    /**
     * Inserts or updates vectors in batch (upsert operation)
     * Accepts 1-500 vectors per request. Larger batches should be split
     *
     * @param options - Vector insertion options
     * @param options.vectorBucketName - Name of the parent vector bucket
     * @param options.indexName - Name of the target index
     * @param options.vectors - Array of vectors to insert/update (1-500 items)
     * @returns Promise with empty response on success or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorConflictException` if duplicate key conflict occurs (HTTP 409)
     * - `S3VectorNotFoundException` if bucket or index doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * const { data, error } = await client.putVectors({
     *   vectorBucketName: 'embeddings-prod',
     *   indexName: 'documents-openai-small',
     *   vectors: [
     *     {
     *       key: 'doc-1',
     *       data: { float32: [0.1, 0.2, 0.3, ...] }, // 1536 dimensions
     *       metadata: { title: 'Introduction', page: 1 }
     *     },
     *     {
     *       key: 'doc-2',
     *       data: { float32: [0.4, 0.5, 0.6, ...] },
     *       metadata: { title: 'Conclusion', page: 42 }
     *     }
     *   ]
     * })
     * ```
     */
    putVectors(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                // Validate batch size
                if (options.vectors.length < 1 || options.vectors.length > 500) {
                    throw new Error('Vector batch size must be between 1 and 500 items');
                }
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/PutVectors`, options, {
                    headers: this.headers,
                });
                return { data: data || {}, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageVectorsError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Retrieves vectors by their keys in batch
     * Optionally includes vector data and/or metadata in response
     * Additional permissions required when returning data or metadata
     *
     * @param options - Vector retrieval options
     * @param options.vectorBucketName - Name of the parent vector bucket
     * @param options.indexName - Name of the index
     * @param options.keys - Array of vector keys to retrieve
     * @param options.returnData - Whether to include vector embeddings (requires permission)
     * @param options.returnMetadata - Whether to include metadata (requires permission)
     * @returns Promise with array of vectors or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorNotFoundException` if bucket or index doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * const { data, error } = await client.getVectors({
     *   vectorBucketName: 'embeddings-prod',
     *   indexName: 'documents-openai-small',
     *   keys: ['doc-1', 'doc-2', 'doc-3'],
     *   returnData: false,     // Don't return embeddings
     *   returnMetadata: true   // Return metadata only
     * })
     * if (data) {
     *   data.vectors.forEach(v => console.log(v.key, v.metadata))
     * }
     * ```
     */
    getVectors(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/GetVectors`, options, {
                    headers: this.headers,
                });
                return { data, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageVectorsError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Lists/scans vectors in an index with pagination
     * Supports parallel scanning via segment configuration for high-throughput scenarios
     * Additional permissions required when returning data or metadata
     *
     * @param options - Vector listing options
     * @param options.vectorBucketName - Name of the parent vector bucket
     * @param options.indexName - Name of the index
     * @param options.maxResults - Maximum results per page (default: 500, max: 1000)
     * @param options.nextToken - Pagination token from previous response
     * @param options.returnData - Whether to include vector embeddings (requires permission)
     * @param options.returnMetadata - Whether to include metadata (requires permission)
     * @param options.segmentCount - Total parallel segments (1-16) for distributed scanning
     * @param options.segmentIndex - Zero-based segment index (0 to segmentCount-1)
     * @returns Promise with array of vectors, pagination token, or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorNotFoundException` if bucket or index doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * // Simple pagination
     * let nextToken: string | undefined
     * do {
     *   const { data, error } = await client.listVectors({
     *     vectorBucketName: 'embeddings-prod',
     *     indexName: 'documents-openai-small',
     *     maxResults: 500,
     *     nextToken,
     *     returnMetadata: true
     *   })
     *   if (error) break
     *   console.log('Batch:', data.vectors.length)
     *   nextToken = data.nextToken
     * } while (nextToken)
     *
     * // Parallel scanning (4 concurrent workers)
     * const workers = [0, 1, 2, 3].map(async (segmentIndex) => {
     *   const { data } = await client.listVectors({
     *     vectorBucketName: 'embeddings-prod',
     *     indexName: 'documents-openai-small',
     *     segmentCount: 4,
     *     segmentIndex,
     *     returnMetadata: true
     *   })
     *   return data?.vectors || []
     * })
     * const results = await Promise.all(workers)
     * ```
     */
    listVectors(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                // Validate segment configuration
                if (options.segmentCount !== undefined) {
                    if (options.segmentCount < 1 || options.segmentCount > 16) {
                        throw new Error('segmentCount must be between 1 and 16');
                    }
                    if (options.segmentIndex !== undefined) {
                        if (options.segmentIndex < 0 || options.segmentIndex >= options.segmentCount) {
                            throw new Error(`segmentIndex must be between 0 and ${options.segmentCount - 1}`);
                        }
                    }
                }
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/ListVectors`, options, {
                    headers: this.headers,
                });
                return { data, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageVectorsError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Queries for similar vectors using approximate nearest neighbor (ANN) search
     * Returns top-K most similar vectors based on the configured distance metric
     * Supports optional metadata filtering (requires GetVectors permission)
     *
     * @param options - Query options
     * @param options.vectorBucketName - Name of the parent vector bucket
     * @param options.indexName - Name of the index
     * @param options.queryVector - Query embedding to find similar vectors
     * @param options.topK - Number of nearest neighbors to return (default: 10)
     * @param options.filter - Optional JSON filter for metadata (requires GetVectors permission)
     * @param options.returnDistance - Whether to include similarity distances
     * @param options.returnMetadata - Whether to include metadata (requires GetVectors permission)
     * @returns Promise with array of similar vectors ordered by distance
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorNotFoundException` if bucket or index doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * // Semantic search with filtering
     * const { data, error } = await client.queryVectors({
     *   vectorBucketName: 'embeddings-prod',
     *   indexName: 'documents-openai-small',
     *   queryVector: { float32: [0.1, 0.2, 0.3, ...] }, // 1536 dimensions
     *   topK: 5,
     *   filter: {
     *     category: 'technical',
     *     published: true
     *   },
     *   returnDistance: true,
     *   returnMetadata: true
     * })
     * if (data) {
     *   data.matches.forEach(match => {
     *     console.log(`${match.key}: distance=${match.distance}`)
     *     console.log('Metadata:', match.metadata)
     *   })
     * }
     * ```
     */
    queryVectors(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/QueryVectors`, options, {
                    headers: this.headers,
                });
                return { data, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageVectorsError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Deletes vectors by their keys in batch
     * Accepts 1-500 keys per request
     *
     * @param options - Vector deletion options
     * @param options.vectorBucketName - Name of the parent vector bucket
     * @param options.indexName - Name of the index
     * @param options.keys - Array of vector keys to delete (1-500 items)
     * @returns Promise with empty response on success or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorNotFoundException` if bucket or index doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * const { error } = await client.deleteVectors({
     *   vectorBucketName: 'embeddings-prod',
     *   indexName: 'documents-openai-small',
     *   keys: ['doc-1', 'doc-2', 'doc-3']
     * })
     * if (!error) {
     *   console.log('Vectors deleted successfully')
     * }
     * ```
     */
    deleteVectors(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                // Validate batch size
                if (options.keys.length < 1 || options.keys.length > 500) {
                    throw new Error('Keys batch size must be between 1 and 500 items');
                }
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/DeleteVectors`, options, {
                    headers: this.headers,
                });
                return { data: data || {}, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageVectorsError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
}
exports.default = VectorDataApi;
//# sourceMappingURL=VectorDataApi.js.map