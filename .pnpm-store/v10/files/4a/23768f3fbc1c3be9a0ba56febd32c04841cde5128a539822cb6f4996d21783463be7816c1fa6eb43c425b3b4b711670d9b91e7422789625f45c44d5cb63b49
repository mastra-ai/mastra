import { StorageError } from '../lib/errors';
import { Fetch } from '../lib/fetch';
import { AnalyticBucket } from '../lib/types';
/**
 * API class for managing Analytics Buckets using Iceberg tables
 * Provides methods for creating, listing, and deleting analytics buckets
 */
export default class StorageAnalyticsApi {
    protected url: string;
    protected headers: {
        [key: string]: string;
    };
    protected fetch: Fetch;
    protected shouldThrowOnError: boolean;
    /**
     * Creates a new StorageAnalyticsApi instance
     * @param url - The base URL for the storage API
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
     */
    throwOnError(): this;
    /**
     * Creates a new analytics bucket using Iceberg tables
     * Analytics buckets are optimized for analytical queries and data processing
     *
     * @param name A unique name for the bucket you are creating
     * @returns Promise with newly created bucket name or error
     *
     * @example
     * ```typescript
     * const { data, error } = await storage.analytics.createBucket('analytics-data')
     * if (error) {
     *   console.error('Failed to create analytics bucket:', error.message)
     * } else {
     *   console.log('Created bucket:', data.name)
     * }
     * ```
     */
    createBucket(name: string): Promise<{
        data: AnalyticBucket;
        error: null;
    } | {
        data: null;
        error: StorageError;
    }>;
    /**
     * Retrieves the details of all Analytics Storage buckets within an existing project
     * Only returns buckets of type 'ANALYTICS'
     *
     * @param options Query parameters for listing buckets
     * @param options.limit Maximum number of buckets to return
     * @param options.offset Number of buckets to skip
     * @param options.sortColumn Column to sort by ('id', 'name', 'created_at', 'updated_at')
     * @param options.sortOrder Sort order ('asc' or 'desc')
     * @param options.search Search term to filter bucket names
     * @returns Promise with list of analytics buckets or error
     *
     * @example
     * ```typescript
     * const { data, error } = await storage.analytics.listBuckets({
     *   limit: 10,
     *   offset: 0,
     *   sortColumn: 'created_at',
     *   sortOrder: 'desc',
     *   search: 'analytics'
     * })
     * if (data) {
     *   console.log('Found analytics buckets:', data.length)
     *   data.forEach(bucket => console.log(`- ${bucket.name}`))
     * }
     * ```
     */
    listBuckets(options?: {
        limit?: number;
        offset?: number;
        sortColumn?: 'id' | 'name' | 'created_at' | 'updated_at';
        sortOrder?: 'asc' | 'desc';
        search?: string;
    }): Promise<{
        data: AnalyticBucket[];
        error: null;
    } | {
        data: null;
        error: StorageError;
    }>;
    /**
     * Deletes an existing analytics bucket
     * A bucket can't be deleted with existing objects inside it
     * You must first empty the bucket before deletion
     *
     * @param bucketId The unique identifier of the bucket you would like to delete
     * @returns Promise with success message or error
     *
     * @example
     * ```typescript
     * const { data, error } = await analyticsApi.deleteBucket('old-analytics-bucket')
     * if (error) {
     *   console.error('Failed to delete bucket:', error.message)
     * } else {
     *   console.log('Bucket deleted successfully:', data.message)
     * }
     * ```
     */
    deleteBucket(bucketId: string): Promise<{
        data: {
            message: string;
        };
        error: null;
    } | {
        data: null;
        error: StorageError;
    }>;
}
//# sourceMappingURL=StorageAnalyticsApi.d.ts.map