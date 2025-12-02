"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scope = void 0;
const analyticsexecutor_1 = require("./analyticsexecutor");
const collection_1 = require("./collection");
const queryexecutor_1 = require("./queryexecutor");
const searchexecutor_1 = require("./searchexecutor");
const scopesearchindexmanager_1 = require("./scopesearchindexmanager");
const utilities_1 = require("./utilities");
const scopeeventingfunctionmanager_1 = require("./scopeeventingfunctionmanager");
/**
 * Exposes the operations which are available to be performed against a scope.
 * Namely the ability to access to Collections for performing operations.
 *
 * @category Core
 */
class Scope {
    /**
     * @internal
     */
    static get DEFAULT_NAME() {
        return '_default';
    }
    /**
    @internal
    */
    constructor(bucket, scopeName) {
        this._bucket = bucket;
        this._name = scopeName;
        this._conn = bucket.conn;
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
    get bucket() {
        return this._bucket;
    }
    /**
    @internal
    */
    get cluster() {
        return this._bucket.cluster;
    }
    /**
    @internal
    */
    get transcoder() {
        return this._bucket.transcoder;
    }
    /**
     * The name of the scope this Scope object references.
     */
    get name() {
        return this._name;
    }
    /**
     * Creates a Collection object reference to a specific collection.
     *
     * @param collectionName The name of the collection to reference.
     */
    collection(collectionName) {
        return new collection_1.Collection(this, collectionName);
    }
    /**
     * Returns a SearchIndexManager which can be used to manage the search
     * indexes of this scope.
     */
    searchIndexes() {
        return new scopesearchindexmanager_1.ScopeSearchIndexManager(this.cluster, this.bucket.name, this._name);
    }
    /**
     * Returns a ScopeEventingFunctionManager which can be used to manage the eventing
     * functions of this scope.
     * Uncommitted: This API is subject to change in the future.
     */
    eventingFunctions() {
        return new scopeeventingfunctionmanager_1.ScopeEventingFunctionManager(this.cluster, this._bucket.name, this._name);
    }
    /**
     * Executes a N1QL query against the cluster scoped to this scope.
     *
     * @param statement The N1QL statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    query(statement, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucket = this.bucket;
        const exec = new queryexecutor_1.QueryExecutor(this.cluster);
        const options_ = options;
        return utilities_1.PromiseHelper.wrapAsync(() => exec.query(statement, {
            ...options_,
            queryContext: `${bucket.name}.${this.name}`,
        }), callback);
    }
    /**
     * Executes an analytics query against the cluster scoped this scope.
     *
     * @param statement The analytics statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    analyticsQuery(statement, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucket = this.bucket;
        const exec = new analyticsexecutor_1.AnalyticsExecutor(this.cluster);
        const options_ = options;
        return utilities_1.PromiseHelper.wrapAsync(() => exec.query(statement, {
            ...options_,
            queryContext: `${bucket.name}.${this.name}`,
        }), callback);
    }
    /**
     * Executes a search query against the scope.
     *
     * @param indexName The name of the index to query.
     * @param request The SearchRequest describing the search to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    search(indexName, request, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const exec = new searchexecutor_1.SearchExecutor(this.cluster, this._bucket.name, this._name);
        const options_ = options;
        return utilities_1.PromiseHelper.wrapAsync(() => exec.query(indexName, request, options_), callback);
    }
}
exports.Scope = Scope;
