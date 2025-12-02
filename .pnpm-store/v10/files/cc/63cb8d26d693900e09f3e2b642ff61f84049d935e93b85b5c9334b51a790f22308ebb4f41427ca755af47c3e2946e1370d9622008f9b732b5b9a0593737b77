"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const constants_1 = require("../lib/constants");
const errors_1 = require("../lib/errors");
const fetch_1 = require("../lib/fetch");
const helpers_1 = require("../lib/helpers");
/**
 * API class for managing Analytics Buckets using Iceberg tables
 * Provides methods for creating, listing, and deleting analytics buckets
 */
class StorageAnalyticsApi {
    /**
     * Creates a new StorageAnalyticsApi instance
     * @param url - The base URL for the storage API
     * @param headers - HTTP headers to include in requests
     * @param fetch - Optional custom fetch implementation
     */
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
     */
    throwOnError() {
        this.shouldThrowOnError = true;
        return this;
    }
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
    createBucket(name) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/bucket`, { name }, { headers: this.headers });
                return { data, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
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
    listBuckets(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                // Build query string from options
                const queryParams = new URLSearchParams();
                if ((options === null || options === void 0 ? void 0 : options.limit) !== undefined)
                    queryParams.set('limit', options.limit.toString());
                if ((options === null || options === void 0 ? void 0 : options.offset) !== undefined)
                    queryParams.set('offset', options.offset.toString());
                if (options === null || options === void 0 ? void 0 : options.sortColumn)
                    queryParams.set('sortColumn', options.sortColumn);
                if (options === null || options === void 0 ? void 0 : options.sortOrder)
                    queryParams.set('sortOrder', options.sortOrder);
                if (options === null || options === void 0 ? void 0 : options.search)
                    queryParams.set('search', options.search);
                const queryString = queryParams.toString();
                const url = queryString ? `${this.url}/bucket?${queryString}` : `${this.url}/bucket`;
                const data = yield (0, fetch_1.get)(this.fetch, url, { headers: this.headers });
                // Filter to only return analytics buckets
                const analyticsBuckets = Array.isArray(data)
                    ? data.filter((bucket) => bucket.type === 'ANALYTICS')
                    : [];
                return { data: analyticsBuckets, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
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
    deleteBucket(bucketId) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.remove)(this.fetch, `${this.url}/bucket/${bucketId}`, {}, { headers: this.headers });
                return { data, error: null };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if ((0, errors_1.isStorageError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
}
exports.default = StorageAnalyticsApi;
//# sourceMappingURL=StorageAnalyticsApi.js.map