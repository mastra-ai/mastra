import StorageFileApi from './packages/StorageFileApi';
import StorageBucketApi from './packages/StorageBucketApi';
import StorageAnalyticsApi from './packages/StorageAnalyticsApi';
import { Fetch } from './lib/fetch';
import { StorageVectorsClient } from './lib/vectors';
export interface StorageClientOptions {
    useNewHostname?: boolean;
}
export declare class StorageClient extends StorageBucketApi {
    constructor(url: string, headers?: {
        [key: string]: string;
    }, fetch?: Fetch, opts?: StorageClientOptions);
    /**
     * Perform file operation in a bucket.
     *
     * @param id The bucket id to operate on.
     */
    from(id: string): StorageFileApi;
    /**
     * Access vector storage operations.
     *
     * @returns A StorageVectorsClient instance configured with the current storage settings.
     */
    get vectors(): StorageVectorsClient;
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
    get analytics(): StorageAnalyticsApi;
}
//# sourceMappingURL=StorageClient.d.ts.map