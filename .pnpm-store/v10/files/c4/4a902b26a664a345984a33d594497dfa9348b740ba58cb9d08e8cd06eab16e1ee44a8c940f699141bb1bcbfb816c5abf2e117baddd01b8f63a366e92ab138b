"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndexManager = exports.SearchIndex = void 0;
const utilities_1 = require("./utilities");
const bindingutilities_1 = require("./bindingutilities");
/**
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Management
 */
class SearchIndex {
    /**
     * @internal
     */
    constructor(data) {
        this.uuid = data.uuid;
        this.name = data.name;
        this.sourceName = data.sourceName;
        this.type = data.type;
        this.params = data.params;
        this.sourceUuid = data.sourceUuid;
        this.sourceParams = data.sourceParams;
        this.sourceType = data.sourceType;
        this.planParams = data.planParams;
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        return {
            uuid: data.uuid,
            name: data.name,
            type: data.type,
            params_json: JSON.stringify(data.params),
            source_uuid: data.sourceUuid,
            source_name: data.sourceName,
            source_type: data.sourceType,
            source_params_json: JSON.stringify(data.sourceParams),
            plan_params_json: JSON.stringify(data.planParams),
        };
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        const idx = new SearchIndex({
            uuid: data.uuid,
            name: data.name,
            type: data.type,
            params: {},
            sourceUuid: data.source_uuid,
            sourceName: data.source_name,
            sourceType: data.source_type,
            sourceParams: {},
            planParams: {},
        });
        if (data.params_json) {
            idx.params = JSON.parse(data.params_json);
        }
        if (data.source_params_json) {
            idx.sourceParams = JSON.parse(data.source_params_json);
        }
        if (data.plan_params_json) {
            idx.planParams = JSON.parse(data.plan_params_json);
        }
        return idx;
    }
}
exports.SearchIndex = SearchIndex;
/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * @category Management
 */
class SearchIndexManager {
    /**
     * @internal
     */
    constructor(cluster) {
        this._cluster = cluster;
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
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const index = SearchIndex._fromCppData(resp.index);
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
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const indexes = resp.indexes.map((indexData) => SearchIndex._fromCppData(indexData));
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
                index: SearchIndex._toCppData(indexDefinition),
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
exports.SearchIndexManager = SearchIndexManager;
