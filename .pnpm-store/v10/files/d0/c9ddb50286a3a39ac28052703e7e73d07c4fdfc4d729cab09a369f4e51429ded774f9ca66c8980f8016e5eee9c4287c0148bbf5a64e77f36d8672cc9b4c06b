"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
const binarycollection_1 = require("./binarycollection");
const binding_1 = __importStar(require("./binding"));
const bindingutilities_1 = require("./bindingutilities");
const crudoptypes_1 = require("./crudoptypes");
const datastructures_1 = require("./datastructures");
const errors_1 = require("./errors");
const generaltypes_1 = require("./generaltypes");
const queryindexmanager_1 = require("./queryindexmanager");
const rangeScan_1 = require("./rangeScan");
const sdspecs_1 = require("./sdspecs");
const sdutils_1 = require("./sdutils");
const streamablepromises_1 = require("./streamablepromises");
const utilities_1 = require("./utilities");
/**
 * Exposes the operations which are available to be performed against a collection.
 * Namely the ability to perform KV operations.
 *
 * @category Core
 */
class Collection {
    /**
     * @internal
     */
    static get DEFAULT_NAME() {
        return '_default';
    }
    /**
    @internal
    */
    constructor(scope, collectionName) {
        this._scope = scope;
        this._name = collectionName;
        this._conn = scope.conn;
        this._kvScanTimeout = 75000;
        this._scanBatchByteLimit = 15000;
        this._scanBatchItemLimit = 50;
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
        return this._scope.bucket.cluster;
    }
    /**
    @internal
    */
    get scope() {
        return this._scope;
    }
    /**
    @internal
    */
    get transcoder() {
        return this._scope.transcoder;
    }
    /**
    @internal
    */
    _mutationTimeout(durabilityLevel) {
        if (durabilityLevel !== undefined &&
            durabilityLevel !== null &&
            durabilityLevel !== generaltypes_1.DurabilityLevel.None) {
            return this.cluster.kvDurableTimeout;
        }
        return this.cluster.kvTimeout;
    }
    /**
     * @internal
     */
    _cppDocId(key) {
        return {
            bucket: this.scope.bucket.name,
            scope: this.scope.name || '_default',
            collection: this.name || '_default',
            key: key,
        };
    }
    /**
     * @internal
     */
    _encodeDoc(transcoder, value, callback) {
        try {
            const [bytesBuf, flagsOut] = transcoder.encode(value);
            callback(null, bytesBuf, flagsOut);
        }
        catch (e) {
            return callback(e, Buffer.alloc(0), 0);
        }
    }
    /**
     * @internal
     */
    _decodeDoc(transcoder, bytes, flags, callback) {
        try {
            const content = transcoder.decode(bytes, flags);
            callback(null, content);
        }
        catch (e) {
            return callback(e, null);
        }
    }
    /**
     * @internal
     */
    _subdocEncode(value) {
        return Buffer.from(value);
    }
    /**
     * @internal
     */
    _subdocDecode(bytes) {
        try {
            return JSON.parse(bytes.toString('utf8'));
        }
        catch (e) {
            // If we encounter a parse error, assume that we need
            // to return bytes instead of an object.
            return bytes;
        }
    }
    /**
     * The name of the collection this Collection object references.
     */
    get name() {
        return this._name;
    }
    /**
     * Retrieves the value of a document from the collection.
     *
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    get(key, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        if (options.project || options.withExpiry) {
            return this._projectedGet(key, options, callback);
        }
        const transcoder = options.transcoder || this.transcoder;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.get({
                id: this._cppDocId(key),
                timeout,
                partition: 0,
                opaque: 0,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                this._decodeDoc(transcoder, resp.value, resp.flags, (err, content) => {
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(null, new crudoptypes_1.GetResult({
                        content: content,
                        cas: resp.cas,
                    }));
                });
            });
        }, callback);
    }
    _projectedGet(key, options, callback) {
        let expiryStart = -1;
        let projStart = -1;
        let paths = [];
        let spec = [];
        let needReproject = false;
        if (options.withExpiry) {
            expiryStart = spec.length;
            spec.push(sdspecs_1.LookupInSpec.get(sdspecs_1.LookupInMacro.Expiry));
        }
        projStart = spec.length;
        if (!options.project) {
            paths = [''];
            spec.push(sdspecs_1.LookupInSpec.get(''));
        }
        else {
            let projects = options.project;
            if (!Array.isArray(projects)) {
                projects = [projects];
            }
            for (let i = 0; i < projects.length; ++i) {
                paths.push(projects[i]);
                spec.push(sdspecs_1.LookupInSpec.get(projects[i]));
            }
        }
        // The following code relies on the projections being
        // the last segment of the specs array, this way we handle
        // an overburdened operation in a single area.
        if (spec.length > 16) {
            spec = spec.splice(0, projStart);
            spec.push(sdspecs_1.LookupInSpec.get(''));
            needReproject = true;
        }
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            const res = await this.lookupIn(key, spec, {
                ...options,
            });
            let content = null;
            let expiry = undefined;
            if (expiryStart >= 0) {
                const expiryRes = res.content[expiryStart];
                expiry = expiryRes.value;
            }
            if (projStart >= 0) {
                if (!needReproject) {
                    for (let i = 0; i < paths.length; ++i) {
                        const projPath = paths[i];
                        const projRes = res.content[projStart + i];
                        if (!projRes.error) {
                            content = sdutils_1.SdUtils.insertByPath(content, projPath, projRes.value);
                        }
                    }
                }
                else {
                    content = {};
                    const reprojRes = res.content[projStart];
                    for (let j = 0; j < paths.length; ++j) {
                        const reprojPath = paths[j];
                        const value = sdutils_1.SdUtils.getByPath(reprojRes.value, reprojPath);
                        content = sdutils_1.SdUtils.insertByPath(content, reprojPath, value);
                    }
                }
            }
            return new crudoptypes_1.GetResult({
                content: content,
                cas: res.cas,
                expiryTime: expiry,
            });
        }, callback);
    }
    /**
     * Checks whether a specific document exists or not.
     *
     * @param key The document key to check for existence.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    exists(key, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.exists({
                id: this._cppDocId(key),
                partition: 0,
                opaque: 0,
                timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                if (resp.deleted) {
                    return wrapCallback(null, new crudoptypes_1.ExistsResult({
                        cas: undefined,
                        exists: false,
                    }));
                }
                wrapCallback(null, new crudoptypes_1.ExistsResult({
                    cas: resp.cas,
                    exists: resp.document_exists,
                }));
            });
        }, callback);
    }
    /**
     * @internal
     */
    _getReplica(key, getAllReplicas, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const emitter = new streamablepromises_1.StreamableReplicasPromise((replicas) => replicas);
        const transcoder = options.transcoder || this.transcoder;
        const timeout = options.timeout || this.cluster.kvTimeout;
        if (getAllReplicas) {
            this._conn.getAllReplicas({
                id: this._cppDocId(key),
                timeout: timeout,
                read_preference: (0, bindingutilities_1.readPreferenceToCpp)(options.readPreference),
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    emitter.emit('error', err);
                    emitter.emit('end');
                    return;
                }
                resp.entries.forEach((replica) => {
                    this._decodeDoc(transcoder, replica.value, replica.flags, (err, content) => {
                        if (err) {
                            emitter.emit('error', err);
                            emitter.emit('end');
                            return;
                        }
                        emitter.emit('replica', new crudoptypes_1.GetReplicaResult({
                            content: content,
                            cas: replica.cas,
                            isReplica: replica.replica,
                        }));
                    });
                });
                emitter.emit('end');
                return;
            });
        }
        else {
            this._conn.getAnyReplica({
                id: this._cppDocId(key),
                timeout: timeout,
                read_preference: (0, bindingutilities_1.readPreferenceToCpp)(options.readPreference),
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    emitter.emit('error', err);
                    emitter.emit('end');
                    return;
                }
                this._decodeDoc(transcoder, resp.value, resp.flags, (err, content) => {
                    if (err) {
                        emitter.emit('error', err);
                        emitter.emit('end');
                        return;
                    }
                    emitter.emit('replica', new crudoptypes_1.GetReplicaResult({
                        content: content,
                        cas: resp.cas,
                        isReplica: resp.replica,
                    }));
                });
                emitter.emit('end');
                return;
            });
        }
        return utilities_1.PromiseHelper.wrapAsync(() => emitter, callback);
    }
    /**
     * Retrieves the value of the document from any of the available replicas.  This
     * will return as soon as the first response is received from any replica node.
     *
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAnyReplica(key, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            const replicas = await this._getReplica(key, false, options);
            return replicas[0];
        }, callback);
    }
    /**
     * Retrieves the value of the document from all available replicas.  Note that
     * as replication is asynchronous, each node may return a different value.
     *
     * @param key The document key to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllReplicas(key, options, callback) {
        return this._getReplica(key, true, options, callback);
    }
    /**
     * Inserts a new document to the collection, failing if the document already exists.
     *
     * @param key The document key to insert.
     * @param value The value of the document to insert.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    insert(key, value, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const transcoder = options.transcoder || this.transcoder;
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this._mutationTimeout(durabilityLevel);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._encodeDoc(transcoder, value, (err, bytes, flags) => {
                if (err) {
                    return wrapCallback(err, null);
                }
                const insertReq = {
                    id: this._cppDocId(key),
                    value: bytes,
                    flags,
                    expiry: expiry,
                    timeout,
                    partition: 0,
                    opaque: 0,
                };
                const insertCallback = (cppErr, resp) => {
                    const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(err, new crudoptypes_1.MutationResult({
                        cas: resp.cas,
                        token: resp.token,
                    }));
                };
                if (persistTo || replicateTo) {
                    this._conn.insertWithLegacyDurability({
                        ...insertReq,
                        persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                        replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                    }, insertCallback);
                }
                else {
                    this._conn.insert({
                        ...insertReq,
                        durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                    }, insertCallback);
                }
            });
        }, callback);
    }
    /**
     * Upserts a document to the collection.  This operation succeeds whether or not the
     * document already exists.
     *
     * @param key The document key to upsert.
     * @param value The new value for the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsert(key, value, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const preserve_expiry = options.preserveExpiry;
        const transcoder = options.transcoder || this.transcoder;
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this._mutationTimeout(durabilityLevel);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._encodeDoc(transcoder, value, (err, bytes, flags) => {
                if (err) {
                    return wrapCallback(err, null);
                }
                const upsertReq = {
                    id: this._cppDocId(key),
                    value: bytes,
                    flags,
                    expiry: expiry,
                    preserve_expiry: preserve_expiry || false,
                    timeout,
                    partition: 0,
                    opaque: 0,
                };
                const upsertCallback = (cppErr, resp) => {
                    const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(err, new crudoptypes_1.MutationResult({
                        cas: resp.cas,
                        token: resp.token,
                    }));
                };
                if (persistTo || replicateTo) {
                    this._conn.upsertWithLegacyDurability({
                        ...upsertReq,
                        persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                        replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                    }, upsertCallback);
                }
                else {
                    this._conn.upsert({
                        ...upsertReq,
                        durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                    }, upsertCallback);
                }
            });
        }, callback);
    }
    /**
     * Replaces the value of an existing document.  Failing if the document does not exist.
     *
     * @param key The document key to replace.
     * @param value The new value for the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    replace(key, value, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const cas = options.cas;
        const preserve_expiry = options.preserveExpiry;
        const transcoder = options.transcoder || this.transcoder;
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this._mutationTimeout(durabilityLevel);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._encodeDoc(transcoder, value, (err, bytes, flags) => {
                if (err) {
                    return wrapCallback(err, null);
                }
                const replaceReq = {
                    id: this._cppDocId(key),
                    value: bytes,
                    flags,
                    expiry,
                    cas: cas || binding_1.zeroCas,
                    preserve_expiry: preserve_expiry || false,
                    timeout,
                    partition: 0,
                    opaque: 0,
                };
                const replaceCallback = (cppErr, resp) => {
                    const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(err, new crudoptypes_1.MutationResult({
                        cas: resp.cas,
                        token: resp.token,
                    }));
                };
                if (persistTo || replicateTo) {
                    this._conn.replaceWithLegacyDurability({
                        ...replaceReq,
                        persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                        replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                    }, replaceCallback);
                }
                else {
                    this._conn.replace({
                        ...replaceReq,
                        durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                    }, replaceCallback);
                }
            });
        }, callback);
    }
    /**
     * Remove an existing document from the collection.
     *
     * @param key The document key to remove.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    remove(key, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const cas = options.cas;
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this._mutationTimeout(durabilityLevel);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const removeReq = {
                id: this._cppDocId(key),
                cas: cas || binding_1.zeroCas,
                timeout,
                partition: 0,
                opaque: 0,
            };
            const removeCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.MutationResult({
                    cas: resp.cas,
                    token: resp.token,
                }));
            };
            if (persistTo || replicateTo) {
                this._conn.removeWithLegacyDurability({
                    ...removeReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, removeCallback);
            }
            else {
                this._conn.remove({
                    ...removeReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, removeCallback);
            }
        }, callback);
    }
    /**
     * Retrieves the value of the document and simultanously updates the expiry time
     * for the same document.
     *
     * @param key The document to fetch and touch.
     * @param expiry The new expiry to apply to the document.
     *   The expiry can be provided as:
     *   - A `number` of seconds relative to the current time.
     *   - A `Date` object for an absolute expiry time.
     *
     *   **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAndTouch(key, expiry, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const transcoder = options.transcoder || this.transcoder;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.getAndTouch({
                id: this._cppDocId(key),
                expiry: (0, utilities_1.parseExpiry)(expiry),
                timeout,
                partition: 0,
                opaque: 0,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                this._decodeDoc(transcoder, resp.value, resp.flags, (err, content) => {
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(err, new crudoptypes_1.GetResult({
                        content: content,
                        cas: resp.cas,
                    }));
                });
            });
        }, callback);
    }
    /**
     * Updates the expiry on an existing document.
     *
     * @param key The document key to touch.
     * @param expiry The new expiry to set for the document, specified in seconds.
     *   The expiry can be provided as:
     *   - A `number` of seconds relative to the current time.
     *   - A `Date` object for an absolute expiry time.
     *
     *   **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    touch(key, expiry, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.touch({
                id: this._cppDocId(key),
                expiry: (0, utilities_1.parseExpiry)(expiry),
                timeout,
                partition: 0,
                opaque: 0,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.MutationResult({
                    cas: resp.cas,
                }));
            });
        }, callback);
    }
    /**
     * Locks a document and retrieves the value of that document at the time it is locked.
     *
     * @param key The document key to retrieve and lock.
     * @param lockTime The amount of time to lock the document for, specified in seconds.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAndLock(key, lockTime, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const transcoder = options.transcoder || this.transcoder;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.getAndLock({
                id: this._cppDocId(key),
                lock_time: lockTime,
                timeout,
                partition: 0,
                opaque: 0,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                this._decodeDoc(transcoder, resp.value, resp.flags, (err, content) => {
                    if (err) {
                        return wrapCallback(err, null);
                    }
                    wrapCallback(err, new crudoptypes_1.GetResult({
                        cas: resp.cas,
                        content: content,
                    }));
                });
            });
        }, callback);
    }
    /**
     * Unlocks a previously locked document.
     *
     * @param key The document key to unlock.
     * @param cas The CAS of the document, used to validate lock ownership.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    unlock(key, cas, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.unlock({
                id: this._cppDocId(key),
                cas,
                timeout,
                partition: 0,
                opaque: 0,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err);
                }
                wrapCallback(null);
            });
        }, callback);
    }
    /**
     * @internal
     */
    _continueScan(iterator, transcoder, emitter) {
        iterator.next((cppErr, resp) => {
            const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
            if (err) {
                emitter.emit('error', err);
                emitter.emit('end');
                return;
            }
            if (typeof resp === 'undefined') {
                emitter.emit('end');
                return;
            }
            const key = resp.key;
            if (typeof resp.body !== 'undefined') {
                const cas = resp.body.cas;
                const expiry = resp.body.expiry;
                this._decodeDoc(transcoder, resp.body.value, resp.body.flags, (err, content) => {
                    if (err) {
                        emitter.emit('error', err);
                        emitter.emit('end');
                        return;
                    }
                    emitter.emit('result', new crudoptypes_1.ScanResult({
                        id: key,
                        content: content,
                        cas: cas,
                        expiryTime: expiry,
                    }));
                });
            }
            else {
                emitter.emit('result', new crudoptypes_1.ScanResult({
                    id: key,
                }));
            }
            if (emitter.cancelRequested && !iterator.cancelled) {
                iterator.cancel();
            }
            this._continueScan(iterator, transcoder, emitter);
            return;
        });
    }
    /**
     * @internal
     */
    _doScan(scanType, options, transcoder, callback) {
        const bucketName = this._scope.bucket.name;
        const scopeName = this._scope.name;
        const collectionName = this._name;
        return utilities_1.PromiseHelper.wrapAsync(() => {
            const { cppErr, result } = this._conn.scan(bucketName, scopeName, collectionName, scanType.getScanType(), (0, bindingutilities_1.scanTypeToCpp)(scanType), options);
            const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
            if (err) {
                throw err;
            }
            const emitter = new streamablepromises_1.StreamableScanPromise((results) => results);
            this._continueScan(result, transcoder, emitter);
            return emitter;
        }, callback);
    }
    /**
     * Performs a key-value scan operation.
     *
     * Use this API for low concurrency batch queries where latency is not a critical as the system
     * may have to scan a lot of documents to find the matching documents.
     * For low latency range queries, it is recommended that you use SQL++ with the necessary indexes.
     *
     * @param scanType The type of scan to execute.
     * @param options Optional parameters for the scan operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    scan(scanType, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const transcoder = options.transcoder || this.transcoder;
        const timeout = options.timeout || this._kvScanTimeout;
        const idsOnly = options.idsOnly || false;
        const batchByteLimit = options.batchByteLimit || this._scanBatchByteLimit;
        const batchItemLimit = options.batchByteLimit || this._scanBatchItemLimit;
        if (typeof options.concurrency !== 'undefined' && options.concurrency < 1) {
            throw new errors_1.InvalidArgumentError(new Error('Concurrency option must be positive'));
        }
        const concurrency = options.concurrency || 1;
        if (scanType instanceof rangeScan_1.SamplingScan && scanType.limit < 1) {
            throw new errors_1.InvalidArgumentError(new Error('Sampling scan limit must be positive'));
        }
        const orchestratorOptions = {
            ids_only: idsOnly,
            consistent_with: (0, bindingutilities_1.mutationStateToCpp)(options.consistentWith),
            batch_item_limit: batchItemLimit,
            batch_byte_limit: batchByteLimit,
            concurrency: concurrency,
            timeout: timeout,
        };
        return this._doScan(scanType, orchestratorOptions, transcoder, callback);
    }
    /**
     * Performs a lookup-in operation against a document, fetching individual fields or
     * information about specific fields inside the document value.
     *
     * @param key The document key to look in.
     * @param specs A list of specs describing the data to fetch from the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    lookupIn(key, specs, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        if (specs.length === 0) {
            throw new errors_1.InvalidArgumentError(new Error('At least one lookup spec must be provided.'));
        }
        const cppSpecs = [];
        for (let i = 0; i < specs.length; ++i) {
            cppSpecs.push({
                opcode_: specs[i]._op,
                flags_: specs[i]._flags,
                path_: specs[i]._path,
                original_index_: i,
            });
        }
        const timeout = options.timeout || this.cluster.kvTimeout;
        const accessDeleted = options.accessDeleted || false;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._conn.lookupIn({
                id: this._cppDocId(key),
                specs: cppSpecs,
                timeout,
                partition: 0,
                opaque: 0,
                access_deleted: accessDeleted,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (resp && resp.fields) {
                    const content = [];
                    for (let i = 0; i < resp.fields.length; ++i) {
                        const itemRes = resp.fields[i];
                        const error = (0, bindingutilities_1.errorFromCpp)(itemRes.ec);
                        let value = undefined;
                        if (itemRes.value && itemRes.value.length > 0) {
                            value = this._subdocDecode(itemRes.value);
                        }
                        if (itemRes.opcode === binding_1.default.protocol_subdoc_opcode.exists) {
                            value = itemRes.exists;
                        }
                        content.push(new crudoptypes_1.LookupInResultEntry({
                            error,
                            value,
                        }));
                    }
                    wrapCallback(err, new crudoptypes_1.LookupInResult({
                        content: content,
                        cas: resp.cas,
                    }));
                    return;
                }
                wrapCallback(err, null);
            });
        }, callback);
    }
    /**
     * @internal
     */
    _lookupInReplica(key, lookupInAllReplicas, specs, options, callback) {
        if (options instanceof Function) {
            callback = arguments[3];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        if (specs.length === 0) {
            throw new errors_1.InvalidArgumentError(new Error('At least one lookup spec must be provided.'));
        }
        const emitter = new streamablepromises_1.StreamableReplicasPromise((replicas) => replicas);
        const cppSpecs = [];
        for (let i = 0; i < specs.length; ++i) {
            cppSpecs.push({
                opcode_: specs[i]._op,
                flags_: specs[i]._flags,
                path_: specs[i]._path,
                original_index_: i,
            });
        }
        const timeout = options.timeout || this.cluster.kvTimeout;
        if (lookupInAllReplicas) {
            this._conn.lookupInAllReplicas({
                id: this._cppDocId(key),
                specs: cppSpecs,
                timeout: timeout,
                read_preference: (0, bindingutilities_1.readPreferenceToCpp)(options.readPreference),
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    emitter.emit('error', err);
                    emitter.emit('end');
                    return;
                }
                resp.entries.forEach((replica) => {
                    const content = [];
                    for (let i = 0; i < replica.fields.length; ++i) {
                        const itemRes = replica.fields[i];
                        const error = (0, bindingutilities_1.errorFromCpp)(itemRes.ec);
                        let value = undefined;
                        if (itemRes.value && itemRes.value.length > 0) {
                            value = this._subdocDecode(itemRes.value);
                        }
                        if (itemRes.opcode === binding_1.default.protocol_subdoc_opcode.exists) {
                            value = itemRes.exists;
                        }
                        content.push(new crudoptypes_1.LookupInResultEntry({
                            error,
                            value,
                        }));
                    }
                    emitter.emit('replica', new crudoptypes_1.LookupInReplicaResult({
                        content: content,
                        cas: replica.cas,
                        isReplica: replica.is_replica,
                    }));
                });
                emitter.emit('end');
                return;
            });
        }
        else {
            this._conn.lookupInAnyReplica({
                id: this._cppDocId(key),
                specs: cppSpecs,
                timeout: timeout,
                read_preference: (0, bindingutilities_1.readPreferenceToCpp)(options.readPreference),
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    emitter.emit('error', err);
                    emitter.emit('end');
                    return;
                }
                const content = [];
                for (let i = 0; i < resp.fields.length; ++i) {
                    const itemRes = resp.fields[i];
                    const error = (0, bindingutilities_1.errorFromCpp)(itemRes.ec);
                    let value = undefined;
                    if (itemRes.value && itemRes.value.length > 0) {
                        value = this._subdocDecode(itemRes.value);
                    }
                    if (itemRes.opcode === binding_1.default.protocol_subdoc_opcode.exists) {
                        value = itemRes.exists;
                    }
                    content.push(new crudoptypes_1.LookupInResultEntry({
                        error,
                        value,
                    }));
                }
                emitter.emit('replica', new crudoptypes_1.LookupInReplicaResult({
                    content: content,
                    cas: resp.cas,
                    isReplica: resp.is_replica,
                }));
                emitter.emit('end');
                return;
            });
        }
        return utilities_1.PromiseHelper.wrapAsync(() => emitter, callback);
    }
    /**
     * Performs a lookup-in operation against a document, fetching individual fields or
     * information about specific fields inside the document value from any of the available
     * replicas in the cluster.
     *
     * @param key The document key to look in.
     * @param specs A list of specs describing the data to fetch from the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    lookupInAnyReplica(key, specs, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            const replicas = await this._lookupInReplica(key, false, specs, options);
            return replicas[0];
        }, callback);
    }
    /**
     * Performs a lookup-in operation against a document, fetching individual fields or
     * information about specific fields inside the document value from all available replicas.
     * Note that as replication is asynchronous, each node may return a different value.
     *
     * @param key The document key to look in.
     * @param specs A list of specs describing the data to fetch from the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    lookupInAllReplicas(key, specs, options, callback) {
        return this._lookupInReplica(key, true, specs, options, callback);
    }
    /**
     * Performs a mutate-in operation against a document.  Allowing atomic modification of
     * specific fields within a document.  Also enables access to document extended-attributes.
     *
     * @param key The document key to mutate.
     * @param specs A list of specs describing the operations to perform on the document.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    mutateIn(key, specs, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        if (specs.length === 0) {
            throw new errors_1.InvalidArgumentError(new Error('At least one lookup spec must be provided.'));
        }
        const cppSpecs = [];
        for (let i = 0; i < specs.length; ++i) {
            cppSpecs.push({
                opcode_: specs[i]._op,
                flags_: specs[i]._flags,
                path_: specs[i]._path,
                value_: specs[i]._data
                    ? this._subdocEncode(specs[i]._data)
                    : specs[i]._data,
                original_index_: 0,
            });
        }
        const storeSemantics = options.upsertDocument
            ? generaltypes_1.StoreSemantics.Upsert
            : options.storeSemantics;
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const preserveExpiry = options.preserveExpiry;
        const cas = options.cas;
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this._mutationTimeout(durabilityLevel);
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const mutateInReq = {
                id: this._cppDocId(key),
                store_semantics: (0, bindingutilities_1.storeSemanticToCpp)(storeSemantics),
                specs: cppSpecs,
                expiry,
                preserve_expiry: preserveExpiry || false,
                cas: cas || binding_1.zeroCas,
                timeout,
                partition: 0,
                opaque: 0,
                access_deleted: false,
                create_as_deleted: false,
            };
            const mutateInCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (resp && resp.fields) {
                    const content = [];
                    for (let i = 0; i < resp.fields.length; ++i) {
                        const itemRes = resp.fields[i];
                        let value = undefined;
                        if (itemRes.value && itemRes.value.length > 0) {
                            value = this._subdocDecode(itemRes.value);
                        }
                        content.push(new crudoptypes_1.MutateInResultEntry({
                            value,
                        }));
                    }
                    wrapCallback(err, new crudoptypes_1.MutateInResult({
                        content: content,
                        cas: resp.cas,
                        token: resp.token,
                    }));
                    return;
                }
                wrapCallback(err, null);
            };
            if (persistTo || replicateTo) {
                this._conn.mutateInWithLegacyDurability({
                    ...mutateInReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, mutateInCallback);
            }
            else {
                this._conn.mutateIn({
                    ...mutateInReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, mutateInCallback);
            }
        }, callback);
    }
    /**
     * Returns a CouchbaseList permitting simple list storage in a document.
     *
     * @param key The document key the data-structure resides in.
     */
    list(key) {
        return new datastructures_1.CouchbaseList(this, key);
    }
    /**
     * Returns a CouchbaseQueue permitting simple queue storage in a document.
     *
     * @param key The document key the data-structure resides in.
     */
    queue(key) {
        return new datastructures_1.CouchbaseQueue(this, key);
    }
    /**
     * Returns a CouchbaseMap permitting simple map storage in a document.
     *
     * @param key The document key the data-structure resides in.
     */
    map(key) {
        return new datastructures_1.CouchbaseMap(this, key);
    }
    /**
     * Returns a CouchbaseSet permitting simple set storage in a document.
     *
     * @param key The document key the data-structure resides in.
     */
    set(key) {
        return new datastructures_1.CouchbaseSet(this, key);
    }
    /**
     * Returns a BinaryCollection object reference, allowing access to various
     * binary operations possible against a collection.
     */
    binary() {
        return new binarycollection_1.BinaryCollection(this);
    }
    /**
     * @internal
     */
    _binaryIncrement(key, delta, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const initial_value = options.initial;
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const incrementReq = {
                id: this._cppDocId(key),
                delta,
                initial_value,
                expiry: expiry,
                timeout,
                partition: 0,
                opaque: 0,
            };
            const incrementCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.CounterResult({
                    cas: resp.cas,
                    token: resp.token,
                    value: resp.content,
                }));
            };
            if (persistTo || replicateTo) {
                this._conn.incrementWithLegacyDurability({
                    ...incrementReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, incrementCallback);
            }
            else {
                this._conn.increment({
                    ...incrementReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, incrementCallback);
            }
        }, callback);
    }
    /**
     * @internal
     */
    _binaryDecrement(key, delta, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const initial_value = options.initial;
        const expiry = (0, utilities_1.parseExpiry)(options.expiry);
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            const decrementReq = {
                id: this._cppDocId(key),
                delta,
                initial_value,
                expiry: expiry,
                timeout,
                partition: 0,
                opaque: 0,
            };
            const decrementCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.CounterResult({
                    cas: resp.cas,
                    token: resp.token,
                    value: resp.content,
                }));
            };
            if (persistTo || replicateTo) {
                this._conn.decrementWithLegacyDurability({
                    ...decrementReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, decrementCallback);
            }
            else {
                this._conn.decrement({
                    ...decrementReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, decrementCallback);
            }
        }, callback);
    }
    /**
     * @internal
     */
    _binaryAppend(key, value, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const cas = options.cas;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            if (!Buffer.isBuffer(value)) {
                value = Buffer.from(value);
            }
            const appendReq = {
                id: this._cppDocId(key),
                value,
                cas: cas || binding_1.zeroCas,
                timeout,
                partition: 0,
                opaque: 0,
            };
            const appendCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.MutationResult({
                    cas: resp.cas,
                    token: resp.token,
                }));
            };
            if (persistTo || replicateTo) {
                this._conn.appendWithLegacyDurability({
                    ...appendReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, appendCallback);
            }
            else {
                this._conn.append({
                    ...appendReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, appendCallback);
            }
        }, callback);
    }
    /**
     * @internal
     */
    _binaryPrepend(key, value, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const durabilityLevel = options.durabilityLevel;
        const persistTo = options.durabilityPersistTo;
        const replicateTo = options.durabilityReplicateTo;
        const cas = options.cas;
        const timeout = options.timeout || this.cluster.kvTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            if (!Buffer.isBuffer(value)) {
                value = Buffer.from(value);
            }
            const prependReq = {
                id: this._cppDocId(key),
                value,
                cas: cas || binding_1.zeroCas,
                timeout,
                partition: 0,
                opaque: 0,
            };
            const prependCallback = (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err, new crudoptypes_1.MutationResult({
                    cas: resp.cas,
                    token: resp.token,
                }));
            };
            if (persistTo || replicateTo) {
                this._conn.prependWithLegacyDurability({
                    ...prependReq,
                    persist_to: (0, bindingutilities_1.persistToToCpp)(persistTo),
                    replicate_to: (0, bindingutilities_1.replicateToToCpp)(replicateTo),
                }, prependCallback);
            }
            else {
                this._conn.prepend({
                    ...prependReq,
                    durability_level: (0, bindingutilities_1.durabilityToCpp)(durabilityLevel),
                }, prependCallback);
            }
        }, callback);
    }
    /**
     * Returns a CollectionQueryIndexManager which can be used to manage the query indexes
     * of this collection.
     */
    queryIndexes() {
        return new queryindexmanager_1.CollectionQueryIndexManager(this);
    }
}
exports.Collection = Collection;
