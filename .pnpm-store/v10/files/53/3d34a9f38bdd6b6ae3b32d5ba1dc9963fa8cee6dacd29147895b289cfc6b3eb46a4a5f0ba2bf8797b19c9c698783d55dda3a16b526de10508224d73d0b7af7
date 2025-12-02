import { CppTopologyCollectionsManifestCollection, CppTopologyCollectionsManifestScope } from './binding';
import { Bucket } from './bucket';
import { NodeCallback } from './utilities';
/**
 * Provides options for configuring a collection.
 *
 * @category Management
 */
export interface ICollectionSpec {
    /**
     * The name of the collection.
     */
    name: string;
    /**
     * The name of the scope containing this collection.
     */
    scopeName: string;
    /**
     * The maximum expiry for documents in this collection.
     *
     * @see {@link IBucketSettings.maxExpiry}
     */
    maxExpiry?: number;
    /**
     * The history retention override setting in this collection.
     * Only supported on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    history?: boolean;
}
/**
 * Contains information about a collection.
 *
 * @category Management
 */
export declare class CollectionSpec {
    /**
     * The name of the collection.
     */
    name: string;
    /**
     * The name of the scope this collection exists in.
     */
    scopeName: string;
    /**
     * The maximum expiry for documents in this collection.
     *
     * @see {@link IBucketSettings.maxExpiry}
     */
    maxExpiry?: number;
    /**
     * The history retention override setting in this collection.
     * Only supported on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    history?: boolean;
    /**
     * @internal
     */
    constructor(data: CollectionSpec);
    /**
     * @internal
     */
    static _fromCppData(scopeName: string, data: CppTopologyCollectionsManifestCollection): CollectionSpec;
}
/**
 * Contains information about a scope.
 *
 * @category Management
 */
export declare class ScopeSpec {
    /**
     * The name of the scope.
     */
    name: string;
    /**
     * The collections which exist in this scope.
     */
    collections: CollectionSpec[];
    /**
     * @internal
     */
    constructor(data: ScopeSpec);
    /**
     * @internal
     */
    static _fromCppData(data: CppTopologyCollectionsManifestScope): ScopeSpec;
}
/**
 * The settings to use when creating the collection.
 *
 * @category Management
 */
export interface CreateCollectionSettings {
    /**
     * The maximum expiry for documents in this collection.
     *
     * @see {@link IBucketSettings.maxExpiry}
     */
    maxExpiry?: number;
    /**
     * The history retention override setting in this collection.
     * Only supported on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    history?: boolean;
}
/**
 * The settings which should be updated on the collection.
 *
 * @category Management
 */
export interface UpdateCollectionSettings {
    /**
     * The maximum expiry for documents in this collection.
     *
     * @see {@link IBucketSettings.maxExpiry}
     */
    maxExpiry?: number;
    /**
     * The history retention override setting in this collection.
     * Only supported on Magma Buckets.
     *
     * @see {@link StorageBackend.Magma}.
     */
    history?: boolean;
}
/**
 * @category Management
 */
export interface CreateCollectionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllScopesOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropCollectionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface CreateScopeOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropScopeOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UpdateCollectionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * CollectionManager allows the management of collections within a Bucket.
 *
 * @category Management
 */
export declare class CollectionManager {
    private _bucket;
    /**
     * @internal
     */
    constructor(bucket: Bucket);
    private get _cluster();
    /**
     * Returns all configured scopes along with their collections.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllScopes(options?: GetAllScopesOptions, callback?: NodeCallback<ScopeSpec[]>): Promise<ScopeSpec[]>;
    /**
     * Creates a collection in a scope.
     *
     * @param collectionSpec Specifies the settings for the new collection.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     * @deprecated Use the other overload instead.
     */
    createCollection(collectionSpec: ICollectionSpec, options?: CreateCollectionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Creates a collection in a scope.
     */
    createCollection(collectionName: string, scopeName: string, options?: CreateCollectionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Creates a collection in a scope.
     *
     * @param collectionName The name of the collection.
     * @param scopeName The name of the scope containing this collection.
     * @param settings The settings to use on creating the collection.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createCollection(collectionName: string, scopeName: string, settings?: CreateCollectionSettings, options?: CreateCollectionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops a collection from a scope.
     *
     * @param collectionName The name of the collection to drop.
     * @param scopeName The name of the scope containing the collection to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropCollection(collectionName: string, scopeName: string, options?: DropCollectionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Updates a collection in a scope.
     *
     * @param collectionName The name of the collection to update.
     * @param scopeName The name of the scope containing the collection.
     * @param settings The settings to update on the collection.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    updateCollection(collectionName: string, scopeName: string, settings: UpdateCollectionSettings, options?: UpdateCollectionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Creates a new scope.
     *
     * @param scopeName The name of the new scope to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createScope(scopeName: string, options?: CreateScopeOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops a scope.
     *
     * @param scopeName The name of the scope to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropScope(scopeName: string, options?: DropScopeOptions, callback?: NodeCallback<void>): Promise<void>;
}
