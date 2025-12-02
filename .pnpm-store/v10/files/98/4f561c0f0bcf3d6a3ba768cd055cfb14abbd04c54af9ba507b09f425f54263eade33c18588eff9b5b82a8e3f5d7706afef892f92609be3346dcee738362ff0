import { CppConnection } from './binding';
import { Cluster } from './cluster';
import { Collection } from './collection';
import { CollectionManager } from './collectionmanager';
import { PingOptions, PingResult } from './diagnosticstypes';
import { Scope } from './scope';
import { StreamableRowPromise } from './streamablepromises';
import { Transcoder } from './transcoders';
import { NodeCallback } from './utilities';
import { ViewIndexManager } from './viewindexmanager';
import { ViewMetaData, ViewQueryOptions, ViewResult, ViewRow } from './viewtypes';
/**
 * Exposes the operations which are available to be performed against a bucket.
 * Namely the ability to access to Collections as well as performing management
 * operations against the bucket.
 *
 * @category Core
 */
export declare class Bucket {
    private _cluster;
    private _name;
    private _conn;
    /**
    @internal
    */
    constructor(cluster: Cluster, bucketName: string);
    /**
    @internal
    */
    get conn(): CppConnection;
    /**
    @internal
    */
    get cluster(): Cluster;
    /**
    @internal
    */
    get transcoder(): Transcoder;
    /**
     * The name of the bucket this Bucket object references.
     */
    get name(): string;
    /**
     * Creates a Scope object reference to a specific scope.
     *
     * @param scopeName The name of the scope to reference.
     */
    scope(scopeName: string): Scope;
    /**
     * Creates a Scope object reference to the default scope.
     */
    defaultScope(): Scope;
    /**
     * Creates a Collection object reference to a specific collection.
     *
     * @param collectionName The name of the collection to reference.
     */
    collection(collectionName: string): Collection;
    /**
     * Creates a Collection object reference to the default collection.
     */
    defaultCollection(): Collection;
    /**
     * Returns a ViewIndexManager which can be used to manage the view indexes
     * of this bucket.
     */
    viewIndexes(): ViewIndexManager;
    /**
     * Returns a CollectionManager which can be used to manage the collections
     * of this bucket.
     */
    collections(): CollectionManager;
    /**
     * Executes a view query.
     *
     * @param designDoc The name of the design document containing the view to execute.
     * @param viewName The name of the view to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    viewQuery<TValue = any, TKey = any>(designDoc: string, viewName: string, options?: ViewQueryOptions, callback?: NodeCallback<ViewResult<TValue, TKey>>): StreamableRowPromise<ViewResult<TValue, TKey>, ViewRow<TValue, TKey>, ViewMetaData>;
    /**
     * Performs a ping operation against the cluster.  Pinging the bucket services
     * which are specified (or all services if none are specified).  Returns a report
     * which describes the outcome of the ping operations which were performed.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    ping(options?: PingOptions, callback?: NodeCallback<PingResult>): Promise<PingResult>;
}
