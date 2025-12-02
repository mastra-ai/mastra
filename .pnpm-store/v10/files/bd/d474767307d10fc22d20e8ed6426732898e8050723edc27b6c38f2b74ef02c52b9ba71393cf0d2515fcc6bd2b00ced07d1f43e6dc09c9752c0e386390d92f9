"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transactions = exports.TransactionAttemptContext = exports.TransactionQueryResult = exports.TransactionGetMultiReplicasFromPreferredServerGroupResult = exports.TransactionGetMultiReplicasFromPreferredServerGroupResultEntry = exports.TransactionGetMultiResult = exports.TransactionGetMultiResultEntry = exports.TransactionGetResult = exports.TransactionResult = exports.TransactionGetMultiReplicasFromPreferredServerGroupSpec = exports.TransactionGetMultiSpec = exports.TransactionGetMultiReplicasFromPreferredServerGroupMode = exports.TransactionGetMultiMode = exports.DocumentId = void 0;
const binding_1 = __importDefault(require("./binding"));
const bindingutilities_1 = require("./bindingutilities");
const errors_1 = require("./errors");
const queryexecutor_1 = require("./queryexecutor");
const transcoders_1 = require("./transcoders");
const utilities_1 = require("./utilities");
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
class DocumentId {
    constructor() {
        this.bucket = '';
        this.scope = '';
        this.collection = '';
        this.key = '';
    }
}
exports.DocumentId = DocumentId;
/**
 * Represents the mode of the Transactional GetMulti operation.
 *
 * @category Transactions
 */
var TransactionGetMultiMode;
(function (TransactionGetMultiMode) {
    /**
     * Indicates that the Transactional GetMulti op should prioritise latency.
     */
    TransactionGetMultiMode["PrioritiseLatency"] = "prioritise_latency";
    /**
     * Indicates that the Transactional GetMulti op should disable read skew detection.
     */
    TransactionGetMultiMode["DisableReadSkewDetection"] = "disable_read_skew_detection";
    /**
     * Indicates that the Transactional GetMulti op should prioritise read skew detection.
     */
    TransactionGetMultiMode["PrioritiseReadSkewDetection"] = "prioritise_read_skew_detection";
})(TransactionGetMultiMode || (exports.TransactionGetMultiMode = TransactionGetMultiMode = {}));
/**
 * Represents the mode of the Transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
var TransactionGetMultiReplicasFromPreferredServerGroupMode;
(function (TransactionGetMultiReplicasFromPreferredServerGroupMode) {
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise latency.
     */
    TransactionGetMultiReplicasFromPreferredServerGroupMode["PrioritiseLatency"] = "prioritise_latency";
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should disable read skew detection.
     */
    TransactionGetMultiReplicasFromPreferredServerGroupMode["DisableReadSkewDetection"] = "disable_read_skew_detection";
    /**
     * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise read skew detection.
     */
    TransactionGetMultiReplicasFromPreferredServerGroupMode["PrioritiseReadSkewDetection"] = "prioritise_read_skew_detection";
})(TransactionGetMultiReplicasFromPreferredServerGroupMode || (exports.TransactionGetMultiReplicasFromPreferredServerGroupMode = TransactionGetMultiReplicasFromPreferredServerGroupMode = {}));
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
class TransactionGetMultiSpec {
    constructor(collection, id, transcoder) {
        this.collection = collection;
        this.id = id;
        this.transcoder = transcoder;
    }
    /**
     * @internal
     */
    _toCppDocumentId() {
        return {
            bucket: this.collection.scope.bucket.name,
            scope: this.collection.scope.name || '_default',
            collection: this.collection.name || '_default',
            key: this.id,
        };
    }
}
exports.TransactionGetMultiSpec = TransactionGetMultiSpec;
/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
class TransactionGetMultiReplicasFromPreferredServerGroupSpec {
    constructor(collection, id, transcoder) {
        this.collection = collection;
        this.id = id;
        this.transcoder = transcoder;
    }
    /**
     * @internal
     */
    _toCppDocumentId() {
        return {
            bucket: this.collection.scope.bucket.name,
            scope: this.collection.scope.name || '_default',
            collection: this.collection.name || '_default',
            key: this.id,
        };
    }
}
exports.TransactionGetMultiReplicasFromPreferredServerGroupSpec = TransactionGetMultiReplicasFromPreferredServerGroupSpec;
/**
 * Contains the results of a Transaction.
 *
 * @category Transactions
 */
class TransactionResult {
    /**
     * @internal
     */
    constructor(data) {
        this.transactionId = data.transactionId;
        this.unstagingComplete = data.unstagingComplete;
    }
}
exports.TransactionResult = TransactionResult;
/**
 * Contains the results of a transactional Get operation.
 *
 * @category Transactions
 */
class TransactionGetResult {
    /**
     * @internal
     */
    constructor(data) {
        this.id = data.id;
        this.content = data.content;
        this.cas = data.cas;
        this._links = data._links;
        this._metadata = data._metadata;
    }
}
exports.TransactionGetResult = TransactionGetResult;
/**
 * Contains the results of a specific sub-operation within a transactional GetMulti operation.
 *
 * @category Transactions
 */
class TransactionGetMultiResultEntry {
    /**
     * @internal
     */
    constructor(data) {
        this.error = data.error || null;
        this.value = data.value;
    }
}
exports.TransactionGetMultiResultEntry = TransactionGetMultiResultEntry;
/**
 * Contains the results of a transactional GetMulti operation.
 *
 * @category Transactions
 */
class TransactionGetMultiResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
    }
    /**
     * Indicates whether the document at the specified index exists.
     *
     * @param index The result index to check.
     */
    exists(index) {
        if (index < 0 || index >= this.content.length) {
            throw new Error(`Index (${index}) out of bounds.`);
        }
        return (this.content[index].error === undefined ||
            this.content[index].error === null);
    }
    /**
     * Provides the content at the specified index, if it exists.
     *
     * @param index The result index to check.
     */
    contentAt(index) {
        if (!this.exists(index)) {
            throw (this.content[index].error ||
                new errors_1.DocumentNotFoundError(new Error(`Document does not exist at index=${index}.`)));
        }
        return this.content[index].value;
    }
}
exports.TransactionGetMultiResult = TransactionGetMultiResult;
/**
 * Contains the results of a specific sub-operation within
 * a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
class TransactionGetMultiReplicasFromPreferredServerGroupResultEntry {
    /**
     * @internal
     */
    constructor(data) {
        this.error = data.error || null;
        this.value = data.value;
    }
}
exports.TransactionGetMultiReplicasFromPreferredServerGroupResultEntry = TransactionGetMultiReplicasFromPreferredServerGroupResultEntry;
/**
 * Contains the results of a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
class TransactionGetMultiReplicasFromPreferredServerGroupResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
    }
    /**
     * Indicates whether the document at the specified index exists.
     *
     * @param index The result index to check.
     */
    exists(index) {
        if (index < 0 || index >= this.content.length) {
            throw new Error(`Index (${index}) out of bounds.`);
        }
        return (this.content[index].error === undefined ||
            this.content[index].error === null);
    }
    /**
     * Provides the content at the specified index, if it exists.
     *
     * @param index The result index to check.
     */
    contentAt(index) {
        if (!this.exists(index)) {
            throw (this.content[index].error ||
                new errors_1.DocumentNotFoundError(new Error(`Document does not exist at index=${index}.`)));
        }
        return this.content[index].value;
    }
}
exports.TransactionGetMultiReplicasFromPreferredServerGroupResult = TransactionGetMultiReplicasFromPreferredServerGroupResult;
/**
 * Contains the results of a transactional Query operation.
 *
 * @category Transactions
 */
class TransactionQueryResult {
    /**
     * @internal
     */
    constructor(data) {
        this.rows = data.rows;
        this.meta = data.meta;
    }
}
exports.TransactionQueryResult = TransactionQueryResult;
/**
 * @internal
 */
function translateGetResult(cppRes, transcoder) {
    if (!cppRes) {
        return null;
    }
    let content;
    if (cppRes.content && cppRes.content.data && cppRes.content.data.length > 0) {
        content = transcoder.decode(cppRes.content.data, cppRes.content.flags);
    }
    return new TransactionGetResult({
        id: cppRes.id,
        content: content,
        cas: cppRes.cas,
        _links: cppRes.links,
        _metadata: cppRes.metadata,
    });
}
/**
 * @internal
 */
function translateGetMultiResult(cppRes, transcoders) {
    if (!cppRes) {
        return null;
    }
    const content = [];
    for (let i = 0; i < cppRes.content.length; ++i) {
        const cppEntry = cppRes.content[i];
        let resultEntry, resultError;
        if (cppEntry && cppEntry.data && cppEntry.data.length > 0) {
            resultEntry = transcoders[i].decode(cppEntry.data, cppEntry.flags);
        }
        else {
            resultError = new errors_1.DocumentNotFoundError(new Error(`Document not found at index=${i}.`));
        }
        content.push(new TransactionGetMultiResultEntry({
            value: resultEntry,
            error: resultError,
        }));
    }
    return new TransactionGetMultiResult({
        content,
    });
}
/**
 * @internal
 */
function translateGetMultiReplicasFromPreferredServerGroupResult(cppRes, transcoders) {
    if (!cppRes) {
        return null;
    }
    const content = [];
    for (let i = 0; i < cppRes.content.length; ++i) {
        const cppEntry = cppRes.content[i];
        let resultEntry, resultError;
        if (cppEntry && cppEntry.data && cppEntry.data.length > 0) {
            resultEntry = transcoders[i].decode(cppEntry.data, cppEntry.flags);
        }
        else {
            resultError = new errors_1.DocumentNotFoundError(new Error(`Document not found at index=${i}.`));
        }
        content.push(new TransactionGetMultiReplicasFromPreferredServerGroupResultEntry({
            value: resultEntry,
            error: resultError,
        }));
    }
    return new TransactionGetMultiReplicasFromPreferredServerGroupResult({
        content,
    });
}
/**
 * Provides an interface to preform transactional operations in a transaction.
 *
 * @category Transactions
 */
class TransactionAttemptContext {
    /**
     * @internal
     */
    constructor(txns, config) {
        if (!config) {
            config = {};
        }
        this._impl = new binding_1.default.Transaction(txns.impl, {
            durability_level: (0, bindingutilities_1.durabilityToCpp)(config.durabilityLevel),
            timeout: config.timeout,
            query_scan_consistency: (0, bindingutilities_1.queryScanConsistencyToCpp)(undefined),
        });
        this._transcoder = new transcoders_1.DefaultTranscoder();
    }
    /**
    @internal
    */
    get impl() {
        return this._impl;
    }
    /**
     * @internal
     */
    _newAttempt() {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.newAttempt((cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                wrapCallback(err);
            });
        });
    }
    /**
     * Retrieves the value of a document from the collection.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     */
    async get(collection, key, options) {
        const transcoder = (options === null || options === void 0 ? void 0 : options.transcoder) || this._transcoder;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const id = collection._cppDocId(key);
            this._impl.get({
                id,
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetResult(cppRes, transcoder));
            });
        });
    }
    /**
     * Retrieves the value of a document from the collection.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     */
    async getReplicaFromPreferredServerGroup(collection, key, options) {
        const transcoder = (options === null || options === void 0 ? void 0 : options.transcoder) || this._transcoder;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const id = collection._cppDocId(key);
            this._impl.getReplicaFromPreferredServerGroup({
                id,
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetResult(cppRes, transcoder));
            });
        });
    }
    /**
     * Retrieves the documents specified in the list of specs.
     *
     * @param specs The documents to retrieve.
     * @param options Optional parameters for this operation.
     */
    async getMultiReplicasFromPreferredServerGroup(specs, options) {
        const ids = specs.map((spec) => spec._toCppDocumentId());
        const transcoders = specs.map((spec) => spec.transcoder || this._transcoder);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.getMultiReplicasFromPreferredServerGroup({
                ids,
                mode: (0, bindingutilities_1.transactionGetMultiReplicasFromPreferredServerGroupModeToCpp)(options === null || options === void 0 ? void 0 : options.mode),
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetMultiReplicasFromPreferredServerGroupResult(cppRes, transcoders));
            });
        });
    }
    /**
     * Retrieves the documents specified in the list of specs.
     *
     * @param specs The documents to retrieve.
     * @param options Optional parameters for this operation.
     */
    async getMulti(specs, options) {
        const ids = specs.map((spec) => spec._toCppDocumentId());
        const transcoders = specs.map((spec) => spec.transcoder || this._transcoder);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.getMulti({
                ids,
                mode: (0, bindingutilities_1.transactionGetMultiModeToCpp)(options === null || options === void 0 ? void 0 : options.mode),
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetMultiResult(cppRes, transcoders));
            });
        });
    }
    /**
     * Inserts a new document to the collection, failing if the document already exists.
     *
     * @param collection The collection the document lives in.
     * @param key The document key to insert.
     * @param content The document content to insert.
     * @param options Optional parameters for this operation.
     */
    async insert(collection, key, content, options) {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const id = collection._cppDocId(key);
            const transcoder = (options === null || options === void 0 ? void 0 : options.transcoder) || this._transcoder;
            const [data, flags] = transcoder.encode(content);
            this._impl.insert({
                id,
                content: {
                    data,
                    flags,
                },
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetResult(cppRes, transcoder));
            });
        });
    }
    /**
     * Replaces a document in a collection.
     *
     * @param doc The document to replace.
     * @param content The document content to insert.
     * @param options Optional parameters for this operation.
     */
    async replace(doc, content, options) {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const transcoder = (options === null || options === void 0 ? void 0 : options.transcoder) || this._transcoder;
            const [data, flags] = transcoder.encode(content);
            this._impl.replace({
                doc: {
                    id: doc.id,
                    content: {
                        data: Buffer.from(''),
                        flags: 0,
                    },
                    cas: doc.cas,
                    links: doc._links,
                    metadata: doc._metadata,
                },
                content: {
                    data,
                    flags,
                },
            }, (cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, translateGetResult(cppRes, transcoder));
            });
        });
    }
    /**
     * Removes a document from a collection.
     *
     * @param doc The document to remove.
     */
    async remove(doc) {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.remove({
                doc: {
                    id: doc.id,
                    content: {
                        data: Buffer.from(''),
                        flags: 0,
                    },
                    cas: doc.cas,
                    links: doc._links,
                    metadata: doc._metadata,
                },
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                wrapCallback(err, null);
            });
        });
    }
    /**
     * Executes a query in the context of this transaction.
     *
     * @param statement The statement to execute.
     * @param options Optional parameters for this operation.
     */
    async query(statement, options) {
        // This await statement is explicit here to ensure our query is completely
        // processed before returning the result to the user (no row streaming).
        const syncQueryRes = await queryexecutor_1.QueryExecutor.execute((callback) => {
            if (!options) {
                options = {};
            }
            this._impl.query(statement, {
                scan_consistency: (0, bindingutilities_1.queryScanConsistencyToCpp)(options.scanConsistency),
                ad_hoc: options.adhoc === false ? false : true,
                client_context_id: options.clientContextId,
                pipeline_batch: options.pipelineBatch,
                pipeline_cap: options.pipelineCap,
                max_parallelism: options.maxParallelism,
                scan_wait: options.scanWait,
                scan_cap: options.scanCap,
                readonly: options.readOnly || false,
                profile: (0, bindingutilities_1.queryProfileToCpp)(options.profile),
                metrics: options.metrics || false,
                raw: options.raw
                    ? Object.fromEntries(Object.entries(options.raw)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, Buffer.from(JSON.stringify(v))]))
                    : {},
                positional_parameters: options.parameters && Array.isArray(options.parameters)
                    ? options.parameters.map((v) => Buffer.from(JSON.stringify(v !== null && v !== void 0 ? v : null)))
                    : [],
                named_parameters: options.parameters && !Array.isArray(options.parameters)
                    ? Object.fromEntries(Object.entries(options.parameters)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, Buffer.from(JSON.stringify(v))]))
                    : {},
            }, (cppErr, resp) => {
                callback(cppErr, resp);
            });
        });
        return new TransactionQueryResult({
            rows: syncQueryRes.rows,
            meta: syncQueryRes.meta,
        });
    }
    /**
     * @internal
     */
    async _commit() {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.commit((cppErr, cppRes) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                let res = null;
                if (cppRes) {
                    res = new TransactionResult({
                        transactionId: cppRes.transaction_id,
                        unstagingComplete: cppRes.unstaging_complete,
                    });
                }
                wrapCallback(err, res);
            });
        });
    }
    /**
     * @internal
     */
    async _rollback() {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.rollback((cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                wrapCallback(err);
            });
        });
    }
}
exports.TransactionAttemptContext = TransactionAttemptContext;
/**
 * Provides an interface to access transactions.
 *
 * @category Transactions
 */
class Transactions {
    /**
    @internal
    */
    constructor(cluster, config) {
        if (!config) {
            config = {};
        }
        if (!config.cleanupConfig) {
            config.cleanupConfig = {};
        }
        if (!config.queryConfig) {
            config.queryConfig = {};
        }
        const connImpl = cluster.conn;
        try {
            const txnsImpl = new binding_1.default.Transactions(connImpl, {
                durability_level: (0, bindingutilities_1.durabilityToCpp)(config.durabilityLevel),
                timeout: config.timeout,
                query_scan_consistency: (0, bindingutilities_1.queryScanConsistencyToCpp)(config.queryConfig.scanConsistency),
                cleanup_window: config.cleanupConfig.cleanupWindow,
                cleanup_lost_attempts: !config.cleanupConfig.disableLostAttemptCleanup,
                cleanup_client_attempts: !config.cleanupConfig.disableClientAttemptCleanup,
                metadata_collection: (0, bindingutilities_1.transactionKeyspaceToCpp)(config.metadataCollection),
            });
            this._cluster = cluster;
            this._impl = txnsImpl;
        }
        catch (err) {
            throw (0, bindingutilities_1.errorFromCpp)(err);
        }
    }
    /**
    @internal
    */
    get impl() {
        return this._impl;
    }
    /**
    @internal
    */
    _close() {
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._impl.close((cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                wrapCallback(err, null);
            });
        });
    }
    /**
     * Executes a transaction.
     *
     * @param logicFn The transaction lambda to execute.
     * @param config Configuration operations for the transaction.
     */
    async run(logicFn, config) {
        const txn = new TransactionAttemptContext(this, config);
        for (;;) {
            await txn._newAttempt();
            try {
                await logicFn(txn);
            }
            catch (e) {
                await txn._rollback();
                if (e instanceof errors_1.TransactionOperationFailedError) {
                    throw new errors_1.TransactionFailedError(e.cause, e.context);
                }
                else if (e instanceof errors_1.TransactionExpiredError ||
                    e instanceof errors_1.TransactionCommitAmbiguousError) {
                    throw e;
                }
                throw new errors_1.TransactionFailedError(e);
            }
            try {
                const txnResult = await txn._commit(); // this is actually finalize internally
                if (!txnResult) {
                    // no result and no error, try again
                    continue;
                }
                return txnResult;
            }
            catch (e) {
                // commit failed, retry...
            }
        }
    }
}
exports.Transactions = Transactions;
