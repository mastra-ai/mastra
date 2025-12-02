"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bucket = void 0;
const collection_1 = require("./collection");
const collectionmanager_1 = require("./collectionmanager");
const diagnosticsexecutor_1 = require("./diagnosticsexecutor");
const scope_1 = require("./scope");
const utilities_1 = require("./utilities");
const viewexecutor_1 = require("./viewexecutor");
const viewindexmanager_1 = require("./viewindexmanager");
/**
 * Exposes the operations which are available to be performed against a bucket.
 * Namely the ability to access to Collections as well as performing management
 * operations against the bucket.
 *
 * @category Core
 */
class Bucket {
    /**
    @internal
    */
    constructor(cluster, bucketName) {
        this._cluster = cluster;
        this._name = bucketName;
        this._conn = cluster.conn;
    }
    /**
    @internal
    */
    get conn() {
        return this._conn;
    }
    /**
    @internal
    */
    get cluster() {
        return this._cluster;
    }
    /**
    @internal
    */
    get transcoder() {
        return this._cluster.transcoder;
    }
    /**
     * The name of the bucket this Bucket object references.
     */
    get name() {
        return this._name;
    }
    /**
     * Creates a Scope object reference to a specific scope.
     *
     * @param scopeName The name of the scope to reference.
     */
    scope(scopeName) {
        return new scope_1.Scope(this, scopeName);
    }
    /**
     * Creates a Scope object reference to the default scope.
     */
    defaultScope() {
        return this.scope(scope_1.Scope.DEFAULT_NAME);
    }
    /**
     * Creates a Collection object reference to a specific collection.
     *
     * @param collectionName The name of the collection to reference.
     */
    collection(collectionName) {
        const scope = this.defaultScope();
        return scope.collection(collectionName);
    }
    /**
     * Creates a Collection object reference to the default collection.
     */
    defaultCollection() {
        return this.collection(collection_1.Collection.DEFAULT_NAME);
    }
    /**
     * Returns a ViewIndexManager which can be used to manage the view indexes
     * of this bucket.
     */
    viewIndexes() {
        return new viewindexmanager_1.ViewIndexManager(this);
    }
    /**
     * Returns a CollectionManager which can be used to manage the collections
     * of this bucket.
     */
    collections() {
        return new collectionmanager_1.CollectionManager(this);
    }
    /**
     * Executes a view query.
     *
     * @param designDoc The name of the design document containing the view to execute.
     * @param viewName The name of the view to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    viewQuery(designDoc, viewName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const exec = new viewexecutor_1.ViewExecutor(this);
        const options_ = options;
        return utilities_1.PromiseHelper.wrapAsync(() => exec.query(designDoc, viewName, options_), callback);
    }
    /**
     * Performs a ping operation against the cluster.  Pinging the bucket services
     * which are specified (or all services if none are specified).  Returns a report
     * which describes the outcome of the ping operations which were performed.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    ping(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const exec = new diagnosticsexecutor_1.PingExecutor(this._cluster);
        const options_ = options;
        return utilities_1.PromiseHelper.wrapAsync(() => exec.ping({
            ...options_,
            bucket: this.name,
        }), callback);
    }
}
exports.Bucket = Bucket;
