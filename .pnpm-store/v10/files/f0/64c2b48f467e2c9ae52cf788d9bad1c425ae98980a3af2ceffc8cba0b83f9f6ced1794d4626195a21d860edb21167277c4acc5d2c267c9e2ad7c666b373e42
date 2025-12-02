import { CppManagementClusterBucketSettings } from './binding';
import { Cluster } from './cluster';
import { DurabilityLevel } from './generaltypes';
import { NodeCallback } from './utilities';
/**
 * Represents the various conflict resolution modes which can be used for
 * XDCR synchronization against a bucket.
 *
 * @category Management
 */
export declare enum ConflictResolutionType {
    /**
     * Indicates that timestamps should be used for conflict resolution.  The most
     * recently modified document (according to each server, ie: time synchronization
     * is important) is the one selected to win.
     */
    Timestamp = "lww",
    /**
     * Indicates that the seqno of the document should be used for conflict resolution.
     */
    SequenceNumber = "seqno",
    /**
     * Indicates that custom conflict resolution should be used.
     *
     * @experimental This mode is only available in Couchbase Server 7.1 with the
     * "developer-preview" mode enabled.
     */
    Custom = "custom"
}
/**
 * Represents the type of a bucket.
 *
 * @category Management
 */
export declare enum BucketType {
    /**
     * Indicates the bucket should be a Couchbase bucket.
     */
    Couchbase = "membase",
    /**
     * Indicates the bucket should be a Memcached bucket.
     */
    Memcached = "memcached",
    /**
     * Indicates the bucket should be a Ephemeral bucket.
     */
    Ephemeral = "ephemeral"
}
/**
 * Represents the storage backend to use for a bucket.
 *
 * @category Management
 */
export declare enum StorageBackend {
    /**
     * Indicates the bucket should use the Couchstore storage engine.
     */
    Couchstore = "couchstore",
    /**
     * Indicates the bucket should use the Magma storage engine.
     */
    Magma = "magma"
}
/**
 * Represents the eviction policy that should be used for a bucket.
 *
 * @category Management
 */
export declare enum EvictionPolicy {
    /**
     * Indicates that both the document meta-data and value should be evicted.
     */
    FullEviction = "fullEviction",
    /**
     * Indicates that only the value of a document should be evicted.
     */
    ValueOnly = "valueOnly",
    /**
     * Indicates that the least recently used documents are evicted.
     */
    NotRecentlyUsed = "nruEviction",
    /**
     * Indicates that nothing should be evicted.
     */
    NoEviction = "noEviction"
}
/**
 * Specifies the compression mode that should be used for a bucket.
 *
 * @category Management
 */
export declare enum CompressionMode {
    /**
     * Indicates that compression should not be used on the server.
     */
    Off = "off",
    /**
     * Indicates that compression should be used passively.  That is that if the
     * client sends data which is encrypted, it is stored on the server in its
     * compressed form, but the server does not actively compress documents.
     */
    Passive = "passive",
    /**
     * Indicates that compression should be performed actively.  Even if the
     * client does not transmit the document in a compressed form.
     */
    Active = "active"
}
/**
 * Specifies a number of options which can be used when updating a buckets
 * settings.
 *
 * @category Management
 */
export interface IBucketSettings {
    /**
     * The name of the bucket.
     */
    name: string;
    /**
     * Whether the flush operation (truncating all data in the bucket) should
     * be enabled.
     */
    flushEnabled?: boolean;
    /**
     * The amount of RAM which should be allocated to this bucket, expressed in
     * megabytes.
     */
    ramQuotaMB: number;
    /**
     * The number of replicas that should exist for this bucket.
     */
    numReplicas?: number;
    /**
     * Whether the indexes on this bucket should be replicated.
     */
    replicaIndexes?: boolean;
    /**
     * Specifies the type of bucket that should be used.
     */
    bucketType?: BucketType | string;
    /**
     * Specifies the storage backend to use for the bucket.
     */
    storageBackend?: StorageBackend | string;
    /**
     * Specifies the ejection method that should be used.
     */
    evictionPolicy?: EvictionPolicy | string;
    /**
     * Specifies the maximum expiry time that any document should be permitted
     * to have.  Any documents stored with an expiry configured higher than this
     * will be forced to this number.
     */
    maxExpiry?: number;
    /**
     * Specifies the compression mode that should be used.
     */
    compressionMode?: CompressionMode | string;
    /**
     * Specifies the minimum durability level that should be used for any write
     * operations which are performed against this bucket.
     */
    minimumDurabilityLevel?: DurabilityLevel | string;
    /**
     * Specifies the default history retention on all collections in this bucket.
     * Only available on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    historyRetentionCollectionDefault?: boolean;
    /**
     * Specifies the maximum history retention in bytes on all collections in this bucket.
     */
    historyRetentionBytes?: number;
    /**
     * Specifies the maximum duration in seconds to be covered by the change history that is written
     * to disk for all collections in this bucket.
     */
    historyRetentionDuration?: number;
    /**
     * Specifies the number of vBuckets in this bucket.
     */
    numVBuckets?: number;
    /**
     * Same as {@link IBucketSettings.maxExpiry}.
     *
     * @deprecated Use {@link IBucketSettings.maxExpiry} instead.
     */
    maxTTL?: number;
    /**
     * Same as {@link IBucketSettings.minimumDurabilityLevel}, but represented as
     * the raw server-side configuration string.
     *
     * @deprecated Use {@link IBucketSettings.minimumDurabilityLevel} instead.
     */
    durabilityMinLevel?: string;
    /**
     * Same as {@link IBucketSettings.evictionPolicy}, but represented as
     * the raw server-side configuration string.
     *
     * @deprecated Use {@link IBucketSettings.evictionPolicy} instead.
     */
    ejectionMethod?: EvictionPolicy | string;
}
/**
 * Represents the configured options for a bucket.
 *
 * @category Management
 */
export declare class BucketSettings implements IBucketSettings {
    /**
     * The name of the bucket.
     */
    name: string;
    /**
     * Whether the flush operation (truncating all data in the bucket) should
     * be enabled.
     */
    flushEnabled?: boolean;
    /**
     * The amount of RAM which should be allocated to this bucket, expressed in
     * megabytes.
     */
    ramQuotaMB: number;
    /**
     * The number of replicas that should exist for this bucket.
     */
    numReplicas?: number;
    /**
     * Whether the indexes on this bucket should be replicated.
     */
    replicaIndexes?: boolean;
    /**
     * Specifies the type of bucket that should be used.
     */
    bucketType?: BucketType;
    /**
     * Specifies the storage backend to use for the bucket.
     */
    storageBackend?: StorageBackend | string;
    /**
     * Specifies the ejection method that should be used.
     */
    evictionPolicy?: EvictionPolicy;
    /**
     * Specifies the maximum expiry time that any document should be permitted
     * to have.  Any documents stored with an expiry configured higher than this
     * will be forced to this number.
     */
    maxExpiry?: number;
    /**
     * Specifies the compression mode that should be used.
     */
    compressionMode?: CompressionMode;
    /**
     * Specifies the minimum durability level that should be used for any write
     * operations which are performed against this bucket.
     */
    minimumDurabilityLevel?: DurabilityLevel;
    /**
     * Specifies the default history retention on all collections in this bucket.
     * Only available on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    historyRetentionCollectionDefault?: boolean;
    /**
     * Specifies the maximum history retention in bytes on all collections in this bucket.
     */
    historyRetentionBytes?: number;
    /**
     * Specifies the maximum duration in seconds to be covered by the change history that is written
     * to disk for all collections in this bucket.
     */
    historyRetentionDuration?: number;
    /**
     * Specifies the number of vBuckets in this bucket.
     */
    numVBuckets?: number;
    /**
     * @internal
     */
    constructor(data: BucketSettings);
    /**
     * Same as {@link IBucketSettings.maxExpiry}.
     *
     * @deprecated Use {@link IBucketSettings.maxExpiry} instead.
     */
    get maxTTL(): number;
    set maxTTL(val: number);
    /**
     * Same as {@link IBucketSettings.evictionPolicy}.
     *
     * @deprecated Use {@link IBucketSettings.evictionPolicy} instead.
     */
    get ejectionMethod(): EvictionPolicy | string;
    set ejectionMethod(val: EvictionPolicy | string);
    /**
     * Same as {@link IBucketSettings.minimumDurabilityLevel}, but represented as
     * the raw server-side configuration string.
     *
     * @deprecated Use {@link IBucketSettings.minimumDurabilityLevel} instead.
     */
    get durabilityMinLevel(): string;
    /**
     * @internal
     */
    static _toCppData(data: IBucketSettings): any;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementClusterBucketSettings): BucketSettings;
}
/**
 * Specifies a number of settings which can be set when creating a bucket.
 *
 * @category Management
 */
export interface ICreateBucketSettings extends IBucketSettings {
    /**
     * Specifies the conflict resolution mode to use for XDCR of this bucket.
     */
    conflictResolutionType?: ConflictResolutionType | string;
}
/**
 * @category Management
 */
export interface CreateBucketOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UpdateBucketOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropBucketOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetBucketOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllBucketsOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface FlushBucketOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * BucketManager provides an interface for adding/removing/updating
 * buckets within the cluster.
 *
 * @category Management
 */
export declare class BucketManager {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * Creates a new bucket.
     *
     * @param settings The settings to use for the new bucket.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createBucket(settings: ICreateBucketSettings, options?: CreateBucketOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Updates the settings for an existing bucket.
     *
     * @param settings The new settings to use for the bucket.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    updateBucket(settings: BucketSettings, options?: UpdateBucketOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops an existing bucket.
     *
     * @param bucketName The name of the bucket to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropBucket(bucketName: string, options?: DropBucketOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches the settings in use for a specified bucket.
     *
     * @param bucketName The name of the bucket to fetch settings for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getBucket(bucketName: string, options?: GetBucketOptions, callback?: NodeCallback<BucketSettings>): Promise<BucketSettings>;
    /**
     * Returns a list of existing buckets in the cluster.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllBuckets(options?: GetAllBucketsOptions, callback?: NodeCallback<BucketSettings[]>): Promise<BucketSettings[]>;
    /**
     * Flushes the bucket, deleting all the existing data that is stored in it.
     *
     * @param bucketName The name of the bucket to flush.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    flushBucket(bucketName: string, options?: FlushBucketOptions, callback?: NodeCallback<void>): Promise<void>;
}
