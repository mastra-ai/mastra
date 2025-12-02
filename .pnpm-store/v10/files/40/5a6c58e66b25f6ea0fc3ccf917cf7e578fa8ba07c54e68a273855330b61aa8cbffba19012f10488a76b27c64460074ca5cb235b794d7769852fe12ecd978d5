"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionManager = exports.ScopeSpec = exports.CollectionSpec = void 0;
const bindingutilities_1 = require("./bindingutilities");
const utilities_1 = require("./utilities");
/**
 * Contains information about a collection.
 *
 * @category Management
 */
class CollectionSpec {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.scopeName = data.scopeName;
        this.maxExpiry = data.maxExpiry;
        this.history = data.history;
    }
    /**
     * @internal
     */
    static _fromCppData(scopeName, data) {
        return new CollectionSpec({
            name: data.name,
            scopeName: scopeName,
            maxExpiry: data.max_expiry,
            history: data.history,
        });
    }
}
exports.CollectionSpec = CollectionSpec;
/**
 * Contains information about a scope.
 *
 * @category Management
 */
class ScopeSpec {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.collections = data.collections;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        let collections;
        if (data.collections.length > 0) {
            const scopeName = data.name;
            collections = data.collections.map((collectionData) => CollectionSpec._fromCppData(scopeName, collectionData));
        }
        else {
            collections = [];
        }
        return new ScopeSpec({
            name: data.name,
            collections: collections,
        });
    }
}
exports.ScopeSpec = ScopeSpec;
/**
 * CollectionManager allows the management of collections within a Bucket.
 *
 * @category Management
 */
class CollectionManager {
    /**
     * @internal
     */
    constructor(bucket) {
        this._bucket = bucket;
    }
    get _cluster() {
        return this._bucket.cluster;
    }
    /**
     * Returns all configured scopes along with their collections.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllScopes(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementScopeGetAll({
                bucket_name: bucketName,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const scopes = resp.manifest.scopes.map((scopeData) => ScopeSpec._fromCppData(scopeData));
                wrapCallback(null, scopes);
            });
        }, callback);
    }
    /**
     * @internal
     */
    async createCollection() {
        let collectionName = arguments[0];
        let scopeName = arguments[1];
        let settings = arguments[2];
        let options = arguments[3];
        let callback = arguments[4];
        // Deprecated usage conversion for (CollectionSpec, options, callback)
        if (typeof collectionName === 'object') {
            const spec = collectionName;
            collectionName = spec.name;
            scopeName = spec.scopeName;
            settings = {
                maxExpiry: spec.maxExpiry,
                history: spec.history,
            };
            options = arguments[1];
            callback = arguments[2];
            if (options instanceof Function) {
                callback = arguments[1];
                options = undefined;
            }
        }
        // Handling of callbacks for alternative overloads
        if (settings instanceof Function) {
            callback = arguments[2];
            settings = undefined;
        }
        else if (options instanceof Function) {
            callback = arguments[3];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        if (!settings) {
            settings = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        const maxExpiry = settings === null || settings === void 0 ? void 0 : settings.maxExpiry;
        const history = settings === null || settings === void 0 ? void 0 : settings.history;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementCollectionCreate({
                bucket_name: bucketName,
                scope_name: scopeName,
                collection_name: collectionName,
                max_expiry: maxExpiry,
                history: history,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Drops a collection from a scope.
     *
     * @param collectionName The name of the collection to drop.
     * @param scopeName The name of the scope containing the collection to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropCollection(collectionName, scopeName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementCollectionDrop({
                bucket_name: bucketName,
                scope_name: scopeName,
                collection_name: collectionName,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Updates a collection in a scope.
     *
     * @param collectionName The name of the collection to update.
     * @param scopeName The name of the scope containing the collection.
     * @param settings The settings to update on the collection.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async updateCollection(collectionName, scopeName, settings, options, callback) {
        if (options instanceof Function) {
            callback = arguments[3];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementCollectionUpdate({
                bucket_name: bucketName,
                scope_name: scopeName,
                collection_name: collectionName,
                max_expiry: settings.maxExpiry,
                history: settings.history,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Creates a new scope.
     *
     * @param scopeName The name of the new scope to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async createScope(scopeName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementScopeCreate({
                bucket_name: bucketName,
                scope_name: scopeName,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Drops a scope.
     *
     * @param scopeName The name of the scope to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropScope(scopeName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const bucketName = this._bucket.name;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementScopeDrop({
                bucket_name: bucketName,
                scope_name: scopeName,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
}
exports.CollectionManager = CollectionManager;
