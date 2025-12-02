"use strict";
/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteBatch = exports.WriteResult = void 0;
exports.validateSetOptions = validateSetOptions;
exports.validateDocumentData = validateDocumentData;
exports.validateFieldValue = validateFieldValue;
const document_1 = require("./document");
const logger_1 = require("./logger");
const path_1 = require("./path");
const helpers_1 = require("./reference/helpers");
const serializer_1 = require("./serializer");
const timestamp_1 = require("./timestamp");
const util_1 = require("./util");
const validate_1 = require("./validate");
const trace_util_1 = require("./telemetry/trace-util");
/**
 * A WriteResult wraps the write time set by the Firestore servers on sets(),
 * updates(), and creates().
 *
 * @class WriteResult
 */
class WriteResult {
    /**
     * @private
     *
     * @param _writeTime The time of the corresponding document write.
     */
    constructor(_writeTime) {
        this._writeTime = _writeTime;
    }
    /**
     * The write time as set by the Firestore servers.
     *
     * @type {Timestamp}
     * @name WriteResult#writeTime
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({foo: 'bar'}).then(writeResult => {
     *   console.log(`Document written at: ${writeResult.writeTime.toDate()}`);
     * });
     * ```
     */
    get writeTime() {
        return this._writeTime;
    }
    /**
     * Returns true if this `WriteResult` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return true if this `WriteResult` is equal to the provided value.
     */
    isEqual(other) {
        return (this === other ||
            (other instanceof WriteResult &&
                this._writeTime.isEqual(other._writeTime)));
    }
}
exports.WriteResult = WriteResult;
/**
 * A Firestore WriteBatch that can be used to atomically commit multiple write
 * operations at once.
 *
 * @class WriteBatch
 */
class WriteBatch {
    /**
     * The number of writes in this batch.
     * @private
     * @internal
     */
    get _opCount() {
        return this._ops.length;
    }
    /** @private */
    constructor(firestore) {
        /**
         * An array of document paths and the corresponding write operations that are
         * executed as part of the commit. The resulting `api.IWrite` will be sent to
         * the backend.
         *
         * @private
         * @internal
         */
        this._ops = [];
        this._committed = false;
        this._firestore = firestore;
        this._serializer = new serializer_1.Serializer(firestore);
        this._allowUndefined = !!firestore._settings.ignoreUndefinedProperties;
    }
    /**
     * Checks if this write batch has any pending operations.
     *
     * @private
     * @internal
     */
    get isEmpty() {
        return this._ops.length === 0;
    }
    /**
     * Throws an error if this batch has already been committed.
     *
     * @private
     * @internal
     */
    verifyNotCommitted() {
        if (this._committed) {
            throw new Error('Cannot modify a WriteBatch that has been committed.');
        }
    }
    /**
     * Create a document with the provided object values. This will fail the batch
     * if a document exists at its location.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * created.
     * @param {T} data The object to serialize as the document.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.collection('col').doc();
     *
     * writeBatch.create(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    create(documentRef, data) {
        const ref = (0, helpers_1.validateDocumentReference)('documentRef', documentRef);
        const firestoreData = ref._converter.toFirestore(data);
        validateDocumentData('data', firestoreData, 
        /* allowDeletes= */ false, this._allowUndefined);
        this.verifyNotCommitted();
        const transform = document_1.DocumentTransform.fromObject(ref, firestoreData);
        transform.validate();
        const precondition = new document_1.Precondition({ exists: false });
        const op = () => {
            const document = document_1.DocumentSnapshot.fromObject(ref, firestoreData);
            const write = document.toWriteProto();
            if (!transform.isEmpty) {
                write.updateTransforms = transform.toProto(this._serializer);
            }
            write.currentDocument = precondition.toProto();
            return write;
        };
        this._ops.push({ docPath: documentRef.path, op });
        return this;
    }
    /**
     * Deletes a document from the database.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * deleted.
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the batch if the
     * document doesn't exist or was last updated at a different time.
     * @param {boolean= } precondition.exists If set to true, enforces that the target
     * document must or must not exist.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.delete(documentRef);
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    delete(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentRef, precondition) {
        const ref = (0, helpers_1.validateDocumentReference)('documentRef', documentRef);
        validateDeletePrecondition('precondition', precondition, { optional: true });
        this.verifyNotCommitted();
        const conditions = new document_1.Precondition(precondition);
        const op = () => {
            const write = { delete: ref.formattedName };
            if (!conditions.isEmpty) {
                write.currentDocument = conditions.toProto();
            }
            return write;
        };
        this._ops.push({ docPath: documentRef.path, op });
        return this;
    }
    /**
     * Write to the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document does not
     * exist yet, it will be created. If you pass [SetOptions]{@link SetOptions},
     * the provided data can be merged into the existing document.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * set.
     * @param {T|Partial<T>} data The object to serialize as the document.
     * @param {SetOptions=} options An object to configure the set behavior.
     * @param {boolean=} options.merge - If true, set() merges the values
     * specified in its data argument. Fields omitted from this set() call
     * remain untouched. If your input sets any field to an empty map, all nested
     * fields are overwritten.
     * @param {Array.<string|FieldPath>=} options.mergeFields - If provided,
     * set() only replaces the specified field paths. Any field path that is no
     * specified is ignored and remains untouched. If your input sets any field to
     * an empty map, all nested fields are overwritten.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.set(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    set(documentRef, data, options) {
        validateSetOptions('options', options, { optional: true });
        const mergeLeaves = options && 'merge' in options && options.merge;
        const mergePaths = options && 'mergeFields' in options;
        const ref = (0, helpers_1.validateDocumentReference)('documentRef', documentRef);
        let firestoreData;
        if (mergeLeaves || mergePaths) {
            firestoreData = ref._converter.toFirestore(data, options);
        }
        else {
            firestoreData = ref._converter.toFirestore(data);
        }
        validateDocumentData('data', firestoreData, 
        /* allowDeletes= */ !!(mergePaths || mergeLeaves), this._allowUndefined);
        this.verifyNotCommitted();
        let documentMask;
        if (mergePaths) {
            documentMask = document_1.DocumentMask.fromFieldMask(options.mergeFields);
            firestoreData = documentMask.applyTo(firestoreData);
        }
        const transform = document_1.DocumentTransform.fromObject(ref, firestoreData);
        transform.validate();
        const op = () => {
            const document = document_1.DocumentSnapshot.fromObject(ref, firestoreData);
            if (mergePaths) {
                documentMask.removeFields(transform.fields);
            }
            else if (mergeLeaves) {
                documentMask = document_1.DocumentMask.fromObject(firestoreData);
            }
            const write = document.toWriteProto();
            if (!transform.isEmpty) {
                write.updateTransforms = transform.toProto(this._serializer);
            }
            if (mergePaths || mergeLeaves) {
                write.updateMask = documentMask.toProto();
            }
            return write;
        };
        this._ops.push({ docPath: documentRef.path, op });
        return this;
    }
    /**
     * Update fields of the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document
     * doesn't yet exist, the update fails and the entire batch will be rejected.
     *
     * The update() method accepts either an object with field paths encoded as
     * keys and field values encoded as values, or a variable number of arguments
     * that alternate between field paths and field values. Nested fields can be
     * updated by providing dot-separated field path strings or by providing
     * FieldPath objects.
     *
     * A Precondition restricting this update can be specified as the last
     * argument.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * updated.
     * @param {UpdateData|string|FieldPath} dataOrField An object
     * containing the fields and values with which to update the document
     * or the path of the first field to update.
     * @param {
     * ...(Precondition|*|string|FieldPath)} preconditionOrValues -
     * An alternating list of field paths and values to update or a Precondition
     * to restrict this update.
     * @throws {Error} If the provided input is not valid Firestore data.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.update(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    update(documentRef, dataOrField, ...preconditionOrValues) {
        // eslint-disable-next-line prefer-rest-params
        (0, validate_1.validateMinNumberOfArguments)('WriteBatch.update', arguments, 2);
        (0, helpers_1.validateDocumentReference)('documentRef', documentRef);
        this.verifyNotCommitted();
        const updateMap = new Map();
        let precondition = new document_1.Precondition({ exists: true });
        const argumentError = 'Update() requires either a single JavaScript ' +
            'object or an alternating list of field/value pairs that can be ' +
            'followed by an optional precondition.';
        const usesVarargs = typeof dataOrField === 'string' || dataOrField instanceof path_1.FieldPath;
        if (usesVarargs) {
            const argumentOffset = 1; // Respect 'documentRef' in the error message
            const fieldOrValues = [dataOrField, ...preconditionOrValues];
            try {
                for (let i = 0; i < fieldOrValues.length; i += 2) {
                    if (i === fieldOrValues.length - 1) {
                        const maybePrecondition = fieldOrValues[i];
                        validateUpdatePrecondition(i + argumentOffset, maybePrecondition);
                        precondition = new document_1.Precondition(maybePrecondition);
                    }
                    else {
                        const maybeFieldPath = fieldOrValues[i];
                        (0, path_1.validateFieldPath)(i + argumentOffset, maybeFieldPath);
                        // Unlike the `validateMinNumberOfArguments` invocation above, this
                        // validation can be triggered both from `WriteBatch.update()` and
                        // `DocumentReference.update()`. Hence, we don't use the fully
                        // qualified API name in the error message.
                        (0, validate_1.validateMinNumberOfArguments)('update', fieldOrValues, i + 1);
                        const fieldPath = path_1.FieldPath.fromArgument(maybeFieldPath);
                        validateFieldValue(i + argumentOffset, fieldOrValues[i + 1], this._allowUndefined, fieldPath);
                        updateMap.set(fieldPath, fieldOrValues[i + 1]);
                    }
                }
            }
            catch (err) {
                (0, logger_1.logger)('WriteBatch.update', null, 'Varargs validation failed:', err);
                // We catch the validation error here and re-throw to provide a better
                // error message.
                throw new Error(`${argumentError} ${err.message}`);
            }
        }
        else {
            try {
                validateUpdateMap('dataOrField', dataOrField, this._allowUndefined);
                // eslint-disable-next-line prefer-rest-params
                (0, validate_1.validateMaxNumberOfArguments)('update', arguments, 3);
                Object.entries(dataOrField).forEach(([key, value]) => {
                    // Skip `undefined` values (can be hit if `ignoreUndefinedProperties`
                    // is set)
                    if (value !== undefined) {
                        (0, path_1.validateFieldPath)(key, key);
                        updateMap.set(path_1.FieldPath.fromArgument(key), value);
                    }
                });
                if (preconditionOrValues.length > 0) {
                    validateUpdatePrecondition('preconditionOrValues', preconditionOrValues[0]);
                    precondition = new document_1.Precondition(preconditionOrValues[0]);
                }
            }
            catch (err) {
                (0, logger_1.logger)('WriteBatch.update', null, 'Non-varargs validation failed:', err);
                // We catch the validation error here and prefix the error with a custom
                // message to describe the usage of update() better.
                throw new Error(`${argumentError} ${err.message}`);
            }
        }
        validateNoConflictingFields('dataOrField', updateMap);
        const transform = document_1.DocumentTransform.fromUpdateMap(documentRef, updateMap);
        transform.validate();
        const documentMask = document_1.DocumentMask.fromUpdateMap(updateMap);
        const op = () => {
            const document = document_1.DocumentSnapshot.fromUpdateMap(documentRef, updateMap);
            const write = document.toWriteProto();
            write.updateMask = documentMask.toProto();
            if (!transform.isEmpty) {
                write.updateTransforms = transform.toProto(this._serializer);
            }
            write.currentDocument = precondition.toProto();
            return write;
        };
        this._ops.push({ docPath: documentRef.path, op });
        return this;
    }
    /**
     * Atomically commits all pending operations to the database and verifies all
     * preconditions. Fails the entire write if any precondition is not met.
     *
     * @returns {Promise.<Array.<WriteResult>>} A Promise that resolves
     * when this batch completes.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.set(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    commit() {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_BATCH_COMMIT, async () => {
            // Capture the error stack to preserve stack tracing across async calls.
            const stack = Error().stack;
            // Commits should also be retried when they fail with status code ABORTED.
            const retryCodes = [10 /* StatusCode.ABORTED */, ...(0, util_1.getRetryCodes)('commit')];
            return this._commit({ retryCodes })
                .then(response => {
                return (response.writeResults || []).map(writeResult => new WriteResult(timestamp_1.Timestamp.fromProto(writeResult.updateTime || response.commitTime)));
            })
                .catch(err => {
                throw (0, util_1.wrapError)(err, stack);
            });
        }, {
            [trace_util_1.ATTRIBUTE_KEY_IS_TRANSACTIONAL]: false,
            [trace_util_1.ATTRIBUTE_KEY_DOC_COUNT]: this._opCount,
        });
    }
    /**
     * Commit method that takes an optional transaction ID.
     *
     * @private
     * @internal
     * @param commitOptions Options to use for this commit.
     * @param commitOptions.transactionId The transaction ID of this commit.
     * @param commitOptions.requestTag A unique client-assigned identifier for
     * this request.
     * @returns  A Promise that resolves when this batch completes.
     */
    async _commit(commitOptions) {
        var _a;
        // Note: We don't call `verifyNotCommitted()` to allow for retries.
        this._committed = true;
        const tag = (_a = commitOptions === null || commitOptions === void 0 ? void 0 : commitOptions.requestTag) !== null && _a !== void 0 ? _a : (0, util_1.requestTag)();
        await this._firestore.initializeIfNeeded(tag);
        // Note that the request may not always be of type ICommitRequest. This is
        // just here to ensure type safety.
        const request = {
            database: this._firestore.formattedName,
            writes: this._ops.map(op => op.op()),
        };
        if (commitOptions === null || commitOptions === void 0 ? void 0 : commitOptions.transactionId) {
            request.transaction = commitOptions.transactionId;
        }
        (0, logger_1.logger)('WriteBatch.commit', tag, 'Sending %d writes', request.writes.length);
        return this._firestore.request((commitOptions === null || commitOptions === void 0 ? void 0 : commitOptions.methodName) || 'commit', request, tag, commitOptions === null || commitOptions === void 0 ? void 0 : commitOptions.retryCodes);
    }
    /**
     * Resets the WriteBatch and dequeues all pending operations.
     * @private
     * @internal
     */
    _reset() {
        this._ops.splice(0);
        this._committed = false;
    }
}
exports.WriteBatch = WriteBatch;
/**
 * Validates the use of 'value' as a Precondition and enforces that 'exists'
 * and 'lastUpdateTime' use valid types.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The object to validate
 * @param options Options describing other things for this function to validate.
 */
function validatePrecondition(arg, value, options) {
    if (typeof value !== 'object' || value === null) {
        throw new Error('Input is not an object.');
    }
    const precondition = value;
    let conditions = 0;
    if (precondition.exists !== undefined) {
        ++conditions;
        if (typeof precondition.exists !== 'boolean') {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'precondition')} "exists" is not a boolean.'`);
        }
        if ((options === null || options === void 0 ? void 0 : options.allowedExistsValues) &&
            options.allowedExistsValues.indexOf(precondition.exists) < 0) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'precondition')} ` +
                `"exists" is not allowed to have the value ${precondition.exists} ` +
                `(allowed values: ${options.allowedExistsValues.join(', ')})`);
        }
    }
    if (precondition.lastUpdateTime !== undefined) {
        ++conditions;
        if (!(precondition.lastUpdateTime instanceof timestamp_1.Timestamp)) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'precondition')} "lastUpdateTime" is not a Firestore Timestamp.`);
        }
    }
    if (conditions > 1) {
        throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'precondition')} Input specifies more than one precondition.`);
    }
}
/**
 * Validates the use of 'value' as an update Precondition.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The object to validate.
 * @param options Optional validation options specifying whether the value can
 * be omitted.
 */
function validateUpdatePrecondition(arg, value, options) {
    if (!(0, validate_1.validateOptional)(value, options)) {
        validatePrecondition(arg, value, { allowedExistsValues: [true] });
    }
}
/**
 * Validates the use of 'value' as a delete Precondition.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The object to validate.
 * @param options Optional validation options specifying whether the value can
 * be omitted.
 */
function validateDeletePrecondition(arg, value, options) {
    if (!(0, validate_1.validateOptional)(value, options)) {
        validatePrecondition(arg, value);
    }
}
/**
 * Validates the use of 'value' as SetOptions and enforces that 'merge' is a
 * boolean.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The object to validate.
 * @param options Optional validation options specifying whether the value can
 * be omitted.
 * @throws if the input is not a valid SetOptions object.
 */
function validateSetOptions(arg, value, options) {
    if (!(0, validate_1.validateOptional)(value, options)) {
        if (!(0, util_1.isObject)(value)) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'set() options argument')} Input is not an object.`);
        }
        const setOptions = value;
        if ('mergeFields' in setOptions) {
            for (let i = 0; i < setOptions.mergeFields.length; ++i) {
                try {
                    (0, path_1.validateFieldPath)(i, setOptions.mergeFields[i]);
                }
                catch (err) {
                    throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'set() options argument')} "mergeFields" is not valid: ${err.message}`);
                }
            }
        }
        if ('merge' in setOptions && 'mergeFields' in setOptions) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'set() options argument')} You cannot specify both "merge" and "mergeFields".`);
        }
    }
}
/**
 * Validates a JavaScript object for usage as a Firestore document.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param obj JavaScript object to validate.
 * @param allowDeletes Whether to allow FieldValue.delete() sentinels.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 * @throws when the object is invalid.
 */
function validateDocumentData(arg, obj, allowDeletes, allowUndefined) {
    if (!(0, util_1.isPlainObject)(obj)) {
        throw new Error((0, validate_1.customObjectMessage)(arg, obj));
    }
    (0, serializer_1.validateUserInput)(arg, obj, 'Firestore document', {
        allowDeletes: allowDeletes ? 'all' : 'none',
        allowTransforms: true,
        allowUndefined,
    });
}
/**
 * Validates that a value can be used as field value during an update.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param val The value to verify.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 * @param path The path to show in the error message.
 */
function validateFieldValue(arg, val, allowUndefined, path) {
    (0, serializer_1.validateUserInput)(arg, val, 'Firestore value', { allowDeletes: 'root', allowTransforms: true, allowUndefined }, path);
}
/**
 * Validates that the update data does not contain any ambiguous field
 * definitions (such as 'a.b' and 'a').
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param data An update map with field/value pairs.
 */
function validateNoConflictingFields(arg, data) {
    const fields = [];
    data.forEach((value, key) => {
        fields.push(key);
    });
    fields.sort((left, right) => left.compareTo(right));
    for (let i = 1; i < fields.length; ++i) {
        if (fields[i - 1].isPrefixOf(fields[i])) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'update map')} Field "${fields[i - 1]}" was specified multiple times.`);
        }
    }
}
/**
 * Validates that a JavaScript object is a map of field paths to field values.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param obj JavaScript object to validate.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 * @throws when the object is invalid.
 */
function validateUpdateMap(arg, obj, allowUndefined) {
    if (!(0, util_1.isPlainObject)(obj)) {
        throw new Error((0, validate_1.customObjectMessage)(arg, obj));
    }
    if (Object.keys(obj).length === 0) {
        throw new Error('At least one field must be updated.');
    }
    validateFieldValue(arg, obj, allowUndefined);
}
//# sourceMappingURL=write-batch.js.map