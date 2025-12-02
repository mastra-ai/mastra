import StorageFileApi from './packages/StorageFileApi';
import StorageBucketApi from './packages/StorageBucketApi';
import StorageAnalyticsApi from './packages/StorageAnalyticsApi';
import { StorageVectorsClient } from './lib/vectors';
export class StorageClient extends StorageBucketApi {
    constructor(url, headers = {}, fetch, opts) {
        super(url, headers, fetch, opts);
    }
    /**
     * Perform file operation in a bucket.
     *
     * @param id The bucket id to operate on.
     */
    from(id) {
        return new StorageFileApi(this.url, this.headers, id, this.fetch);
    }
    /**
     * Access vector storage operations.
     *
     * @returns A StorageVectorsClient instance configured with the current storage settings.
     */
    get vectors() {
        return new StorageVectorsClient(this.url + '/vector', {
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
        return new StorageAnalyticsApi(this.url + '/iceberg', this.headers, this.fetch);
    }
}
//# sourceMappingURL=StorageClient.js.map