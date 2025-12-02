"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecursiveDelete = exports.RECURSIVE_DELETE_MIN_PENDING_OPS = exports.RECURSIVE_DELETE_MAX_PENDING_OPS = exports.REFERENCE_NAME_MIN_ID = void 0;
const assert = require("assert");
const _1 = require(".");
const util_1 = require("./util");
const query_options_1 = require("./reference/query-options");
/*!
 * Datastore allowed numeric IDs where Firestore only allows strings. Numeric
 * IDs are exposed to Firestore as __idNUM__, so this is the lowest possible
 * negative numeric value expressed in that format.
 *
 * This constant is used to specify startAt/endAt values when querying for all
 * descendants in a single collection.
 */
exports.REFERENCE_NAME_MIN_ID = '__id-9223372036854775808__';
/*!
 * The query limit used for recursive deletes when fetching all descendants of
 * the specified reference to delete. This is done to prevent the query stream
 * from streaming documents faster than Firestore can delete.
 */
// Visible for testing.
exports.RECURSIVE_DELETE_MAX_PENDING_OPS = 5000;
/*!
 * The number of pending BulkWriter operations at which RecursiveDelete
 * starts the next limit query to fetch descendants. By starting the query
 * while there are pending operations, Firestore can improve BulkWriter
 * throughput. This helps prevent BulkWriter from idling while Firestore
 * fetches the next query.
 */
exports.RECURSIVE_DELETE_MIN_PENDING_OPS = 1000;
/**
 * Class used to store state required for running a recursive delete operation.
 * Each recursive delete call should use a new instance of the class.
 * @private
 * @internal
 */
class RecursiveDelete {
    /**
     *
     * @param firestore The Firestore instance to use.
     * @param writer The BulkWriter instance to use for delete operations.
     * @param ref The document or collection reference to recursively delete.
     * @param maxLimit The query limit to use when fetching descendants
     * @param minLimit The number of pending BulkWriter operations at which
     * RecursiveDelete starts the next limit query to fetch descendants.
     */
    constructor(firestore, writer, ref, maxLimit, minLimit) {
        this.firestore = firestore;
        this.writer = writer;
        this.ref = ref;
        this.maxLimit = maxLimit;
        this.minLimit = minLimit;
        /**
         * The number of deletes that failed with a permanent error.
         * @private
         * @internal
         */
        this.errorCount = 0;
        /**
         * Whether there are still documents to delete that still need to be fetched.
         * @private
         * @internal
         */
        this.documentsPending = true;
        /**
         * Whether run() has been called.
         * @private
         * @internal
         */
        this.started = false;
        /**
         * A deferred promise that resolves when the recursive delete operation
         * is completed.
         * @private
         * @internal
         */
        this.completionDeferred = new util_1.Deferred();
        /**
         * Whether a query stream is currently in progress. Only one stream can be
         * run at a time.
         * @private
         * @internal
         */
        this.streamInProgress = false;
        /**
         * The number of pending BulkWriter operations. Used to determine when the
         * next query can be run.
         * @private
         * @internal
         */
        this.pendingOpsCount = 0;
        this.errorStack = '';
        this.maxPendingOps = maxLimit;
        this.minPendingOps = minLimit;
    }
    /**
     * Recursively deletes the reference provided in the class constructor.
     * Returns a promise that resolves when all descendants have been deleted, or
     * if an error occurs.
     */
    run() {
        assert(!this.started, 'RecursiveDelete.run() should only be called once.');
        // Capture the error stack to preserve stack tracing across async calls.
        this.errorStack = Error().stack;
        this.writer._verifyNotClosed();
        this.setupStream();
        return this.completionDeferred.promise;
    }
    /**
     * Creates a query stream and attaches event handlers to it.
     * @private
     * @internal
     */
    setupStream() {
        const stream = this.getAllDescendants(this.ref instanceof _1.CollectionReference
            ? this.ref
            : this.ref);
        this.streamInProgress = true;
        let streamedDocsCount = 0;
        stream
            .on('error', err => {
            err.code = 14 /* StatusCode.UNAVAILABLE */;
            err.stack = 'Failed to fetch children documents: ' + err.stack;
            this.lastError = err;
            this.onQueryEnd();
        })
            .on('data', (snap) => {
            streamedDocsCount++;
            this.lastDocumentSnap = snap;
            this.deleteRef(snap.ref);
        })
            .on('end', () => {
            this.streamInProgress = false;
            // If there are fewer than the number of documents specified in the
            // limit() field, we know that the query is complete.
            if (streamedDocsCount < this.minPendingOps) {
                this.onQueryEnd();
            }
            else if (this.pendingOpsCount === 0) {
                this.setupStream();
            }
        });
    }
    /**
     * Retrieves all descendant documents nested under the provided reference.
     * @param ref The reference to fetch all descendants for.
     * @private
     * @internal
     * @return {Stream<QueryDocumentSnapshot>} Stream of descendant documents.
     */
    getAllDescendants(ref) {
        // The parent is the closest ancestor document to the location we're
        // deleting. If we are deleting a document, the parent is the path of that
        // document. If we are deleting a collection, the parent is the path of the
        // document containing that collection (or the database root, if it is a
        // root collection).
        let parentPath = ref._resourcePath;
        if (ref instanceof _1.CollectionReference) {
            parentPath = parentPath.popLast();
        }
        const collectionId = ref instanceof _1.CollectionReference
            ? ref.id
            : ref.parent.id;
        let query = new _1.Query(this.firestore, query_options_1.QueryOptions.forKindlessAllDescendants(parentPath, collectionId, 
        /* requireConsistency= */ false));
        // Query for names only to fetch empty snapshots.
        query = query.select(_1.FieldPath.documentId()).limit(this.maxPendingOps);
        if (ref instanceof _1.CollectionReference) {
            // To find all descendants of a collection reference, we need to use a
            // composite filter that captures all documents that start with the
            // collection prefix. The MIN_KEY constant represents the minimum key in
            // this collection, and a null byte + the MIN_KEY represents the minimum
            // key is the next possible collection.
            const nullChar = String.fromCharCode(0);
            const startAt = collectionId + '/' + exports.REFERENCE_NAME_MIN_ID;
            const endAt = collectionId + nullChar + '/' + exports.REFERENCE_NAME_MIN_ID;
            query = query
                .where(_1.FieldPath.documentId(), '>=', startAt)
                .where(_1.FieldPath.documentId(), '<', endAt);
        }
        if (this.lastDocumentSnap) {
            query = query.startAfter(this.lastDocumentSnap);
        }
        return query.stream();
    }
    /**
     * Called when all descendants of the provided reference have been streamed
     * or if a permanent error occurs during the stream. Deletes the developer
     * provided reference and wraps any errors that occurred.
     * @private
     * @internal
     */
    onQueryEnd() {
        this.documentsPending = false;
        if (this.ref instanceof _1.DocumentReference) {
            this.writer.delete(this.ref).catch(err => this.incrementErrorCount(err));
        }
        this.writer.flush().then(async () => {
            var _a;
            if (this.lastError === undefined) {
                this.completionDeferred.resolve();
            }
            else {
                let error = new (require('google-gax/build/src/fallback').GoogleError)(`${this.errorCount} ` +
                    `${this.errorCount !== 1 ? 'deletes' : 'delete'} ` +
                    'failed. The last delete failed with: ');
                if (this.lastError.code !== undefined) {
                    error.code = this.lastError.code;
                }
                error = (0, util_1.wrapError)(error, this.errorStack);
                // Wrap the BulkWriter error last to provide the full stack trace.
                this.completionDeferred.reject(this.lastError.stack
                    ? (0, util_1.wrapError)(error, (_a = this.lastError.stack) !== null && _a !== void 0 ? _a : '')
                    : error);
            }
        });
    }
    /**
     * Deletes the provided reference and starts the next stream if conditions
     * are met.
     * @private
     * @internal
     */
    deleteRef(docRef) {
        this.pendingOpsCount++;
        this.writer
            .delete(docRef)
            .catch(err => {
            this.incrementErrorCount(err);
        })
            .then(() => {
            this.pendingOpsCount--;
            // We wait until the previous stream has ended in order to sure the
            // startAfter document is correct. Starting the next stream while
            // there are pending operations allows Firestore to maximize
            // BulkWriter throughput.
            if (this.documentsPending &&
                !this.streamInProgress &&
                this.pendingOpsCount < this.minPendingOps) {
                this.setupStream();
            }
        });
    }
    incrementErrorCount(err) {
        this.errorCount++;
        this.lastError = err;
    }
}
exports.RecursiveDelete = RecursiveDelete;
//# sourceMappingURL=recursive-delete.js.map