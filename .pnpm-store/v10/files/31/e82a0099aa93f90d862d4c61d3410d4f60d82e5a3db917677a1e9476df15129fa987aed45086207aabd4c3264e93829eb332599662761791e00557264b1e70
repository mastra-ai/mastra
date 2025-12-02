import { Fetch } from './fetch';
import { ApiResponse, VectorBucket, ListVectorBucketsOptions, ListVectorBucketsResponse } from './types';
/**
 * API class for managing Vector Buckets
 * Provides methods for creating, reading, listing, and deleting vector buckets
 */
export default class VectorBucketApi {
    protected url: string;
    protected headers: {
        [key: string]: string;
    };
    protected fetch: Fetch;
    protected shouldThrowOnError: boolean;
    /**
     * Creates a new VectorBucketApi instance
     * @param url - The base URL for the storage vectors API
     * @param headers - HTTP headers to include in requests
     * @param fetch - Optional custom fetch implementation
     */
    constructor(url: string, headers?: {
        [key: string]: string;
    }, fetch?: Fetch);
    /**
     * Enable throwing errors instead of returning them in the response
     * When enabled, failed operations will throw instead of returning { data: null, error }
     *
     * @returns This instance for method chaining
     * @example
     * ```typescript
     * const client = new VectorBucketApi(url, headers)
     * client.throwOnError()
     * const { data } = await client.createBucket('my-bucket') // throws on error
     * ```
     */
    throwOnError(): this;
    /**
     * Creates a new vector bucket
     * Vector buckets are containers for vector indexes and their data
     *
     * @param vectorBucketName - Unique name for the vector bucket
     * @returns Promise with empty response on success or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorConflictException` if bucket already exists (HTTP 409)
     * - `S3VectorMaxBucketsExceeded` if quota exceeded (HTTP 400)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * const { data, error } = await client.createBucket('embeddings-prod')
     * if (error) {
     *   console.error('Failed to create bucket:', error.message)
     * }
     * ```
     */
    createBucket(vectorBucketName: string): Promise<ApiResponse<undefined>>;
    /**
     * Retrieves metadata for a specific vector bucket
     * Returns bucket configuration including encryption settings and creation time
     *
     * @param vectorBucketName - Name of the vector bucket to retrieve
     * @returns Promise with bucket metadata or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorNotFoundException` if bucket doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * const { data, error } = await client.getBucket('embeddings-prod')
     * if (data) {
     *   console.log('Bucket created at:', new Date(data.vectorBucket.creationTime! * 1000))
     * }
     * ```
     */
    getBucket(vectorBucketName: string): Promise<ApiResponse<{
        vectorBucket: VectorBucket;
    }>>;
    /**
     * Lists vector buckets with optional filtering and pagination
     * Supports prefix-based filtering and paginated results
     *
     * @param options - Listing options
     * @param options.prefix - Filter buckets by name prefix
     * @param options.maxResults - Maximum results per page (default: 100)
     * @param options.nextToken - Pagination token from previous response
     * @returns Promise with list of buckets and pagination token
     *
     * @throws {StorageVectorsApiError} With code:
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * // List all buckets with prefix 'prod-'
     * const { data, error } = await client.listBuckets({ prefix: 'prod-' })
     * if (data) {
     *   console.log('Found buckets:', data.buckets.length)
     *   // Fetch next page if available
     *   if (data.nextToken) {
     *     const next = await client.listBuckets({ nextToken: data.nextToken })
     *   }
     * }
     * ```
     */
    listBuckets(options?: ListVectorBucketsOptions): Promise<ApiResponse<ListVectorBucketsResponse>>;
    /**
     * Deletes a vector bucket
     * Bucket must be empty before deletion (all indexes must be removed first)
     *
     * @param vectorBucketName - Name of the vector bucket to delete
     * @returns Promise with empty response on success or error
     *
     * @throws {StorageVectorsApiError} With code:
     * - `S3VectorBucketNotEmpty` if bucket contains indexes (HTTP 400)
     * - `S3VectorNotFoundException` if bucket doesn't exist (HTTP 404)
     * - `InternalError` for server errors (HTTP 500)
     *
     * @example
     * ```typescript
     * // Delete all indexes first, then delete bucket
     * const { error } = await client.deleteBucket('old-bucket')
     * if (error?.statusCode === 'S3VectorBucketNotEmpty') {
     *   console.error('Must delete all indexes first')
     * }
     * ```
     */
    deleteBucket(vectorBucketName: string): Promise<ApiResponse<undefined>>;
}
//# sourceMappingURL=VectorBucketApi.d.ts.map