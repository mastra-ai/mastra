"use strict";
/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
exports.QueryWatch = exports.DocumentWatch = exports.WATCH_IDLE_TIMEOUT_MS = void 0;
const assert = require("assert");
const rbtree = require("functional-red-black-tree");
const google_gax_1 = require("google-gax");
const backoff_1 = require("./backoff");
const document_1 = require("./document");
const document_change_1 = require("./document-change");
const logger_1 = require("./logger");
const path_1 = require("./path");
const timestamp_1 = require("./timestamp");
const types_1 = require("./types");
const util_1 = require("./util");
/*!
 * Target ID used by watch. Watch uses a fixed target id since we only support
 * one target per stream.
 * @type {number}
 */
const WATCH_TARGET_ID = 0x1;
/*!
 * Idle timeout used to detect Watch streams that stall (see
 * https://github.com/googleapis/nodejs-firestore/issues/1057, b/156308554).
 * Under normal load, the Watch backend will send a TARGET_CHANGE message
 * roughly every 30 seconds. As discussed with the backend team, we reset the
 * Watch stream if we do not receive any message within 120 seconds.
 */
exports.WATCH_IDLE_TIMEOUT_MS = 120 * 1000;
/*!
 * Sentinel value for a document remove.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REMOVED = {};
/*!
 * The change type for document change events.
 */
// tslint:disable-next-line:variable-name
const ChangeType = {
    added: 'added',
    modified: 'modified',
    removed: 'removed',
};
/*!
 * The comparator used for document watches (which should always get called with
 * the same document).
 */
const DOCUMENT_WATCH_COMPARATOR = (doc1, doc2) => {
    assert(doc1 === doc2, 'Document watches only support one document.');
    return 0;
};
const EMPTY_FUNCTION = () => { };
/**
 * Watch provides listen functionality and exposes the 'onSnapshot' observer. It
 * can be used with a valid Firestore Listen target.
 *
 * @class
 * @private
 * @internal
 */
class Watch {
    /**
     * @private
     * @internal
     *
     * @param firestore The Firestore Database client.
     */
    constructor(firestore, _converter = (0, types_1.defaultConverter)()) {
        this._converter = _converter;
        /**
         * Indicates whether we are interested in data from the stream. Set to false in the
         * 'unsubscribe()' callback.
         * @private
         * @internal
         */
        this.isActive = true;
        /**
         * The current stream to the backend.
         * @private
         * @internal
         */
        this.currentStream = null;
        /**
         * The server assigns and updates the resume token.
         * @private
         * @internal
         */
        this.resumeToken = undefined;
        /**
         * A map of document names to QueryDocumentSnapshots for the last sent snapshot.
         * @private
         * @internal
         */
        this.docMap = new Map();
        /**
         * The accumulated map of document changes (keyed by document name) for the
         * current snapshot.
         * @private
         * @internal
         */
        this.changeMap = new Map();
        /**
         * The current state of the query results. *
         * @private
         * @internal
         */
        this.current = false;
        /**
         * We need this to track whether we've pushed an initial set of changes,
         * since we should push those even when there are no changes, if there
         * aren't docs.
         * @private
         * @internal
         */
        this.hasPushed = false;
        this.firestore = firestore;
        this.backoff = new backoff_1.ExponentialBackoff();
        this.requestTag = (0, util_1.requestTag)();
        this.onNext = EMPTY_FUNCTION;
        this.onError = EMPTY_FUNCTION;
    }
    /**
     * Starts a watch and attaches a listener for document change events.
     *
     * @private
     * @internal
     * @param onNext A callback to be called every time a new snapshot is
     * available.
     * @param onError A callback to be called if the listen fails or is cancelled.
     * No further callbacks will occur.
     *
     * @returns An unsubscribe function that can be called to cancel the snapshot
     * listener.
     */
    onSnapshot(onNext, onError) {
        assert(this.onNext === EMPTY_FUNCTION, 'onNext should not already be defined.');
        assert(this.onError === EMPTY_FUNCTION, 'onError should not already be defined.');
        assert(this.docTree === undefined, 'docTree should not already be defined.');
        this.onNext = onNext;
        this.onError = onError;
        this.docTree = rbtree(this.getComparator());
        this.initStream();
        const unsubscribe = () => {
            (0, logger_1.logger)('Watch.onSnapshot', this.requestTag, 'Unsubscribe called');
            // Prevent further callbacks.
            this.onNext = () => { };
            this.onError = () => { };
            this.shutdown();
        };
        this.firestore.registerListener();
        return unsubscribe;
    }
    /**
     * Returns the current count of all documents, including the changes from
     * the current changeMap.
     * @private
     * @internal
     */
    currentSize() {
        const changes = this.extractCurrentChanges(timestamp_1.Timestamp.now());
        return this.docMap.size + changes.adds.length - changes.deletes.length;
    }
    /**
     * Splits up document changes into removals, additions, and updates.
     * @private
     * @internal
     */
    extractCurrentChanges(readTime) {
        const deletes = [];
        const adds = [];
        const updates = [];
        this.changeMap.forEach((value, name) => {
            if (value === REMOVED) {
                if (this.docMap.has(name)) {
                    deletes.push(name);
                }
            }
            else if (this.docMap.has(name)) {
                value.readTime = readTime;
                updates.push(value.build());
            }
            else {
                value.readTime = readTime;
                adds.push(value.build());
            }
        });
        return { deletes, adds, updates };
    }
    /**
     * Helper to clear the docs on RESET or filter mismatch.
     * @private
     * @internal
     */
    resetDocs() {
        (0, logger_1.logger)('Watch.resetDocs', this.requestTag, 'Resetting documents');
        this.changeMap.clear();
        this.resumeToken = undefined;
        this.docTree.forEach((snapshot) => {
            // Mark each document as deleted. If documents are not deleted, they
            // will be send again by the server.
            this.changeMap.set(snapshot.ref.path, REMOVED);
        });
        this.current = false;
    }
    /**
     * Closes the stream and calls onError() if the stream is still active.
     * @private
     * @internal
     */
    closeStream(err) {
        if (this.isActive) {
            (0, logger_1.logger)('Watch.closeStream', this.requestTag, 'Invoking onError: ', err);
            this.onError(err);
        }
        this.shutdown();
    }
    /**
     * Re-opens the stream unless the specified error is considered permanent.
     * Clears the change map.
     * @private
     * @internal
     */
    maybeReopenStream(err) {
        if (this.isActive && !this.isPermanentWatchError(err)) {
            (0, logger_1.logger)('Watch.maybeReopenStream', this.requestTag, 'Stream ended, re-opening after retryable error:', err);
            this.changeMap.clear();
            if (this.isResourceExhaustedError(err)) {
                this.backoff.resetToMax();
            }
            this.initStream();
        }
        else {
            this.closeStream(err);
        }
    }
    /**
     * Cancels the current idle timeout and reschedules a new timer.
     *
     * @private
     * @internal
     */
    resetIdleTimeout() {
        if (this.idleTimeoutHandle) {
            clearTimeout(this.idleTimeoutHandle);
        }
        this.idleTimeoutHandle = (0, backoff_1.delayExecution)(() => {
            var _a;
            (0, logger_1.logger)('Watch.resetIdleTimeout', this.requestTag, 'Resetting stream after idle timeout');
            (_a = this.currentStream) === null || _a === void 0 ? void 0 : _a.end();
            this.currentStream = null;
            const error = new google_gax_1.GoogleError('Watch stream idle timeout');
            error.code = google_gax_1.Status.UNKNOWN;
            this.maybeReopenStream(error);
        }, exports.WATCH_IDLE_TIMEOUT_MS);
    }
    /**
     * Helper to restart the outgoing stream to the backend.
     * @private
     * @internal
     */
    resetStream() {
        (0, logger_1.logger)('Watch.resetStream', this.requestTag, 'Restarting stream');
        if (this.currentStream) {
            this.currentStream.end();
            this.currentStream = null;
        }
        this.initStream();
    }
    /**
     * Initializes a new stream to the backend with backoff.
     * @private
     * @internal
     */
    initStream() {
        this.backoff
            .backoffAndWait()
            .then(async () => {
            if (!this.isActive) {
                (0, logger_1.logger)('Watch.initStream', this.requestTag, 'Not initializing inactive stream');
                return;
            }
            await this.firestore.initializeIfNeeded(this.requestTag);
            const request = {};
            request.database = this.firestore.formattedName;
            request.addTarget = this.getTarget(this.resumeToken);
            // Note that we need to call the internal _listen API to pass additional
            // header values in readWriteStream.
            return this.firestore
                .requestStream('listen', 
            /* bidirectional= */ true, request, this.requestTag)
                .then(backendStream => {
                if (!this.isActive) {
                    (0, logger_1.logger)('Watch.initStream', this.requestTag, 'Closing inactive stream');
                    backendStream.emit('end');
                    backendStream.on('error', () => {
                        // Note that emitting 'end' above does not prevent the Duplex
                        // from receiving potential errors from the backend. Since the
                        // stream is no longer active (`isActive` is false), we
                        // swallow / ignore any errors it may receive.
                    });
                    return;
                }
                (0, logger_1.logger)('Watch.initStream', this.requestTag, 'Opened new stream');
                this.currentStream = backendStream;
                this.resetIdleTimeout();
                this.currentStream.on('data', (proto) => {
                    this.resetIdleTimeout();
                    this.onData(proto);
                })
                    .on('error', err => {
                    if (this.currentStream === backendStream) {
                        this.currentStream = null;
                        this.maybeReopenStream(err);
                    }
                })
                    .on('end', () => {
                    if (this.currentStream === backendStream) {
                        this.currentStream = null;
                        const err = new google_gax_1.GoogleError('Stream ended unexpectedly');
                        err.code = google_gax_1.Status.UNKNOWN;
                        this.maybeReopenStream(err);
                    }
                });
                this.currentStream.resume();
            });
        })
            .catch(err => {
            this.closeStream(err);
        });
    }
    /**
     * Handles 'data' events and closes the stream if the response type is
     * invalid.
     * @private
     * @internal
     */
    onData(proto) {
        if (proto.targetChange) {
            (0, logger_1.logger)('Watch.onData', this.requestTag, 'Processing target change');
            const change = proto.targetChange;
            const noTargetIds = !change.targetIds || change.targetIds.length === 0;
            if (change.targetChangeType === 'NO_CHANGE') {
                if (noTargetIds && change.readTime && this.current) {
                    // This means everything is up-to-date, so emit the current
                    // set of docs as a snapshot, if there were changes.
                    this.pushSnapshot(timestamp_1.Timestamp.fromProto(change.readTime), change.resumeToken);
                }
            }
            else if (change.targetChangeType === 'ADD') {
                if (WATCH_TARGET_ID !== change.targetIds[0]) {
                    this.closeStream(Error('Unexpected target ID sent by server'));
                }
            }
            else if (change.targetChangeType === 'REMOVE') {
                let code = google_gax_1.Status.INTERNAL;
                let message = 'internal error';
                if (change.cause) {
                    code = change.cause.code;
                    message = change.cause.message;
                }
                // @todo: Surface a .code property on the exception.
                this.closeStream(new Error('Error ' + code + ': ' + message));
            }
            else if (change.targetChangeType === 'RESET') {
                // Whatever changes have happened so far no longer matter.
                this.resetDocs();
            }
            else if (change.targetChangeType === 'CURRENT') {
                this.current = true;
            }
            else {
                this.closeStream(new Error('Unknown target change type: ' + JSON.stringify(change)));
            }
            if (change.resumeToken &&
                this.affectsTarget(change.targetIds, WATCH_TARGET_ID)) {
                this.backoff.reset();
            }
        }
        else if (proto.documentChange) {
            (0, logger_1.logger)('Watch.onData', this.requestTag, 'Processing change event');
            // No other targetIds can show up here, but we still need to see
            // if the targetId was in the added list or removed list.
            const targetIds = proto.documentChange.targetIds || [];
            const removedTargetIds = proto.documentChange.removedTargetIds || [];
            let changed = false;
            let removed = false;
            for (let i = 0; i < targetIds.length; i++) {
                if (targetIds[i] === WATCH_TARGET_ID) {
                    changed = true;
                }
            }
            for (let i = 0; i < removedTargetIds.length; i++) {
                if (removedTargetIds[i] === WATCH_TARGET_ID) {
                    removed = true;
                }
            }
            const document = proto.documentChange.document;
            const name = document.name;
            const relativeName = path_1.QualifiedResourcePath.fromSlashSeparatedString(name).relativeName;
            if (changed) {
                (0, logger_1.logger)('Watch.onData', this.requestTag, 'Received document change');
                const ref = this.firestore.doc(relativeName);
                const snapshot = new document_1.DocumentSnapshotBuilder(ref.withConverter(this._converter));
                snapshot.fieldsProto = document.fields || {};
                snapshot.createTime = timestamp_1.Timestamp.fromProto(document.createTime);
                snapshot.updateTime = timestamp_1.Timestamp.fromProto(document.updateTime);
                this.changeMap.set(relativeName, snapshot);
            }
            else if (removed) {
                (0, logger_1.logger)('Watch.onData', this.requestTag, 'Received document remove');
                this.changeMap.set(relativeName, REMOVED);
            }
        }
        else if (proto.documentDelete || proto.documentRemove) {
            (0, logger_1.logger)('Watch.onData', this.requestTag, 'Processing remove event');
            const name = (proto.documentDelete || proto.documentRemove).document;
            const relativeName = path_1.QualifiedResourcePath.fromSlashSeparatedString(name).relativeName;
            this.changeMap.set(relativeName, REMOVED);
        }
        else if (proto.filter) {
            (0, logger_1.logger)('Watch.onData', this.requestTag, 'Processing filter update');
            if (proto.filter.count !== this.currentSize()) {
                // We need to remove all the current results.
                this.resetDocs();
                // The filter didn't match, so re-issue the query.
                this.resetStream();
            }
        }
        else {
            this.closeStream(new Error('Unknown listen response type: ' + JSON.stringify(proto)));
        }
    }
    /**
     * Checks if the current target id is included in the list of target ids.
     * If no targetIds are provided, returns true.
     * @private
     * @internal
     */
    affectsTarget(targetIds, currentId) {
        if (targetIds === undefined || targetIds.length === 0) {
            return true;
        }
        for (const targetId of targetIds) {
            if (targetId === currentId) {
                return true;
            }
        }
        return false;
    }
    /**
     * Assembles a new snapshot from the current set of changes and invokes the
     * user's callback. Clears the current changes on completion.
     * @private
     * @internal
     */
    pushSnapshot(readTime, nextResumeToken) {
        const appliedChanges = this.computeSnapshot(readTime);
        if (!this.hasPushed || appliedChanges.length > 0) {
            (0, logger_1.logger)('Watch.pushSnapshot', this.requestTag, 'Sending snapshot with %d changes and %d documents', String(appliedChanges.length), this.docTree.length);
            // We pass the current set of changes, even if `docTree` is modified later.
            const currentTree = this.docTree;
            this.onNext(readTime, currentTree.length, () => currentTree.keys, () => appliedChanges);
            this.hasPushed = true;
        }
        this.changeMap.clear();
        this.resumeToken = nextResumeToken;
    }
    /**
     * Applies a document delete to the document tree and the document map.
     * Returns the corresponding DocumentChange event.
     * @private
     * @internal
     */
    deleteDoc(name) {
        assert(this.docMap.has(name), 'Document to delete does not exist');
        const oldDocument = this.docMap.get(name);
        const existing = this.docTree.find(oldDocument);
        const oldIndex = existing.index;
        this.docTree = existing.remove();
        this.docMap.delete(name);
        return new document_change_1.DocumentChange(ChangeType.removed, oldDocument, oldIndex, -1);
    }
    /**
     * Applies a document add to the document tree and the document map. Returns
     * the corresponding DocumentChange event.
     * @private
     * @internal
     */
    addDoc(newDocument) {
        const name = newDocument.ref.path;
        assert(!this.docMap.has(name), 'Document to add already exists');
        this.docTree = this.docTree.insert(newDocument, null);
        const newIndex = this.docTree.find(newDocument).index;
        this.docMap.set(name, newDocument);
        return new document_change_1.DocumentChange(ChangeType.added, newDocument, -1, newIndex);
    }
    /**
     * Applies a document modification to the document tree and the document map.
     * Returns the DocumentChange event for successful modifications.
     * @private
     * @internal
     */
    modifyDoc(newDocument) {
        const name = newDocument.ref.path;
        assert(this.docMap.has(name), 'Document to modify does not exist');
        const oldDocument = this.docMap.get(name);
        if (!oldDocument.updateTime.isEqual(newDocument.updateTime)) {
            const removeChange = this.deleteDoc(name);
            const addChange = this.addDoc(newDocument);
            return new document_change_1.DocumentChange(ChangeType.modified, newDocument, removeChange.oldIndex, addChange.newIndex);
        }
        return null;
    }
    /**
     * Applies the mutations in changeMap to both the document tree and the
     * document lookup map. Modified docMap in-place and returns the updated
     * state.
     * @private
     * @internal
     */
    computeSnapshot(readTime) {
        const changeSet = this.extractCurrentChanges(readTime);
        const appliedChanges = [];
        // Process the sorted changes in the order that is expected by our clients
        // (removals, additions, and then modifications). We also need to sort the
        // individual changes to assure that oldIndex/newIndex keep incrementing.
        changeSet.deletes.sort((name1, name2) => {
            // Deletes are sorted based on the order of the existing document.
            return this.getComparator()(this.docMap.get(name1), this.docMap.get(name2));
        });
        changeSet.deletes.forEach(name => {
            const change = this.deleteDoc(name);
            appliedChanges.push(change);
        });
        changeSet.adds.sort(this.getComparator());
        changeSet.adds.forEach(snapshot => {
            const change = this.addDoc(snapshot);
            appliedChanges.push(change);
        });
        changeSet.updates.sort(this.getComparator());
        changeSet.updates.forEach(snapshot => {
            const change = this.modifyDoc(snapshot);
            if (change) {
                appliedChanges.push(change);
            }
        });
        assert(this.docTree.length === this.docMap.size, 'The update document ' +
            'tree and document map should have the same number of entries.');
        return appliedChanges;
    }
    /**
     * Determines whether a watch error is considered permanent and should not be
     * retried. Errors that don't provide a GRPC error code are always considered
     * transient in this context.
     *
     * @private
     * @internal
     * @param error An error object.
     * @return Whether the error is permanent.
     */
    isPermanentWatchError(error) {
        if (error.code === undefined) {
            (0, logger_1.logger)('Watch.isPermanentError', this.requestTag, 'Unable to determine error code: ', error);
            return false;
        }
        switch (error.code) {
            case google_gax_1.Status.ABORTED:
            case google_gax_1.Status.CANCELLED:
            case google_gax_1.Status.UNKNOWN:
            case google_gax_1.Status.DEADLINE_EXCEEDED:
            case google_gax_1.Status.RESOURCE_EXHAUSTED:
            case google_gax_1.Status.INTERNAL:
            case google_gax_1.Status.UNAVAILABLE:
            case google_gax_1.Status.UNAUTHENTICATED:
                return false;
            default:
                return true;
        }
    }
    /**
     * Determines whether we need to initiate a longer backoff due to system
     * overload.
     *
     * @private
     * @internal
     * @param error A GRPC Error object that exposes an error code.
     * @return Whether we need to back off our retries.
     */
    isResourceExhaustedError(error) {
        return error.code === google_gax_1.Status.RESOURCE_EXHAUSTED;
    }
    /** Closes the stream and clears all timeouts. */
    shutdown() {
        var _a;
        if (this.isActive) {
            this.isActive = false;
            if (this.idleTimeoutHandle) {
                clearTimeout(this.idleTimeoutHandle);
                this.idleTimeoutHandle = undefined;
            }
            this.firestore.unregisterListener();
        }
        (_a = this.currentStream) === null || _a === void 0 ? void 0 : _a.end();
        this.currentStream = null;
    }
}
/**
 * Creates a new Watch instance to listen on DocumentReferences.
 *
 * @private
 * @internal
 */
class DocumentWatch extends Watch {
    constructor(firestore, ref) {
        super(firestore, ref._converter);
        this.ref = ref;
    }
    getComparator() {
        return DOCUMENT_WATCH_COMPARATOR;
    }
    getTarget(resumeToken) {
        const formattedName = this.ref.formattedName;
        return {
            documents: {
                documents: [formattedName],
            },
            targetId: WATCH_TARGET_ID,
            resumeToken,
        };
    }
}
exports.DocumentWatch = DocumentWatch;
/**
 * Creates a new Watch instance to listen on Queries.
 *
 * @private
 * @internal
 */
class QueryWatch extends Watch {
    constructor(firestore, query, converter) {
        super(firestore, converter);
        this.query = query;
        this.comparator = query.comparator();
    }
    getComparator() {
        return this.query.comparator();
    }
    getTarget(resumeToken) {
        const query = this.query.toProto();
        return { query, targetId: WATCH_TARGET_ID, resumeToken };
    }
}
exports.QueryWatch = QueryWatch;
//# sourceMappingURL=watch.js.map