"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageClient = void 0;
const tslib_1 = require("tslib");
const StorageFileApi_1 = tslib_1.__importDefault(require("./packages/StorageFileApi"));
const StorageBucketApi_1 = tslib_1.__importDefault(require("./packages/StorageBucketApi"));
const StorageAnalyticsApi_1 = tslib_1.__importDefault(require("./packages/StorageAnalyticsApi"));
const vectors_1 = require("./lib/vectors");
class StorageClient extends StorageBucketApi_1.default {
    constructor(url, headers = {}, fetch, opts) {
        super(url, headers, fetch, opts);
    }
    /**
     * Perform file operation in a bucket.
     *
     * @param id The bucket id to operate on.
     */
    from(id) {
        return new StorageFileApi_1.default(this.url, this.headers, id, this.fetch);
    }
    /**
     * Access vector storage operations.
     *
     * @returns A StorageVectorsClient instance configured with the current storage settings.
     */
    get vectors() {
        return new vectors_1.StorageVectorsClient(this.url + '/vector', {
            headers: this.headers,
            fetch: this.fetch,
        });
    }
    /**
     * Access analytics storage operations using Iceberg tables.
     *
     * @returns A StorageAnalyticsApi instance configured with the current storage settings.
     * @example
     * ```typescript
     * const client = createClient(url, key)
     * const analytics = client.storage.analytics
     *
     * // Create an analytics bucket
     * await analytics.createBucket('my-analytics-bucket')
     *
     * // List all analytics buckets
     * const { data: buckets } = await analytics.listBuckets()
     *
     * // Delete an analytics bucket
     * await analytics.deleteBucket('old-analytics-bucket')
     * ```
     */
    get analytics() {
        return new StorageAnalyticsApi_1.default(this.url + '/iceberg', this.headers, this.fetch);
    }
}
exports.StorageClient = StorageClient;
//# sourceMappingURL=StorageClient.js.map