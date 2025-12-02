"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeSearchIndexManager = void 0;
const utilities_1 = require("./utilities");
const bindingutilities_1 = require("./bindingutilities");
const searchindexmanager_1 = require("./searchindexmanager");
/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * @category Management
 */
class ScopeSearchIndexManager {
    /**
     * @internal
     */
    constructor(cluster, bucketName, scopeName) {
        this._cluster = cluster;
        this._bucketName = bucketName;
        this._scopeName = scopeName;
    }
    /**
     * Returns an index by it's name.
     *
     * @param indexName The index to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getIndex(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexGet({
                index_name: indexName,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const index = searchindexmanager_1.SearchIndex._fromCppData(resp.index);
                wrapCallback(null, index);
            });
        }, callback);
    }
    /**
     * Returns a list of all existing indexes.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllIndexes(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexGetAll({
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const indexes = resp.indexes.map((indexData) => searchindexmanager_1.SearchIndex._fromCppData(indexData));
                wrapCallback(null, indexes);
            });
        }, callback);
    }
    /**
     * Creates or updates an existing index.
     *
     * @param indexDefinition The index to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async upsertIndex(indexDefinition, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexUpsert({
                index: searchindexmanager_1.SearchIndex._toCppData(indexDefinition),
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Drops an index.
     *
     * @param indexName The name of the index to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropIndex(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexDrop({
                index_name: indexName,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Returns the number of documents that have been indexed.
     *
     * @param indexName The name of the index to return the count for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getIndexedDocumentsCount(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexGetDocumentsCount({
                index_name: indexName,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(null, resp.count);
            });
        }, callback);
    }
    /**
     * Pauses the ingestion of documents into an index.
     *
     * @param indexName The name of the index to pause.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async pauseIngest(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlIngest({
                index_name: indexName,
                pause: true,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Resumes the ingestion of documents into an index.
     *
     * @param indexName The name of the index to resume.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async resumeIngest(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlIngest({
                index_name: indexName,
                pause: false,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Enables querying of an index.
     *
     * @param indexName The name of the index to enable querying for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async allowQuerying(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlQuery({
                index_name: indexName,
                allow: true,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Disables querying of an index.
     *
     * @param indexName The name of the index to disable querying for.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async disallowQuerying(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlQuery({
                index_name: indexName,
                allow: false,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Freezes the indexing plan for execution of queries.
     *
     * @param indexName The name of the index to freeze the plan of.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async freezePlan(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlPlanFreeze({
                index_name: indexName,
                freeze: true,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Unfreezes the indexing plan for execution of queries.
     *
     * @param indexName The name of the index to freeze the plan of.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async unfreezePlan(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexControlPlanFreeze({
                index_name: indexName,
                freeze: false,
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
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
     * Performs analysis of a specific document by an index.
     *
     * @param indexName The name of the index to use for the analysis.
     * @param document The document to analyze.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async analyzeDocument(indexName, document, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementSearchIndexAnalyzeDocument({
                index_name: indexName,
                encoded_document: JSON.stringify(document),
                timeout: timeout,
                bucket_name: this._bucketName,
                scope_name: this._scopeName,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const result = JSON.parse(resp.analysis);
                wrapCallback(result, null);
            });
        }, callback);
    }
}
exports.ScopeSearchIndexManager = ScopeSearchIndexManager;
