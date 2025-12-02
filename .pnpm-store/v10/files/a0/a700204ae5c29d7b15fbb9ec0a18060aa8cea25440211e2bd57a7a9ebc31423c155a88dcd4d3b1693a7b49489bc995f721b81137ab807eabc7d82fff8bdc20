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
import * as firestore from '@google-cloud/firestore';
import { google } from '../protos/firestore_v1_proto_api';
import { QueryDocumentSnapshot } from './document';
import { DocumentChange } from './document-change';
import { DocumentReference, Firestore, Query } from './index';
import { Timestamp } from './timestamp';
import api = google.firestore.v1;
/*!
 * Idle timeout used to detect Watch streams that stall (see
 * https://github.com/googleapis/nodejs-firestore/issues/1057, b/156308554).
 * Under normal load, the Watch backend will send a TARGET_CHANGE message
 * roughly every 30 seconds. As discussed with the backend team, we reset the
 * Watch stream if we do not receive any message within 120 seconds.
 */
export declare const WATCH_IDLE_TIMEOUT_MS: number;
/**
 * @private
 * @internal
 * @callback docsCallback
 * @returns {Array.<QueryDocumentSnapshot>} An ordered list of documents.
 */
/**
 * @private
 * @internal
 * @callback changeCallback
 * @returns {Array.<DocumentChange>} An ordered list of document
 * changes.
 */
/**
 * onSnapshot() callback that receives the updated query state.
 *
 * @private
 * @internal
 * @callback watchSnapshotCallback
 *
 * @param {Timestamp} readTime The time at which this snapshot was obtained.
 * @param {number} size The number of documents in the result set.
 * @param {docsCallback} docs A callback that returns the ordered list of
 * documents stored in this snapshot.
 * @param {changeCallback} changes A callback that returns the list of
 * changed documents since the last snapshot delivered for this watch.
 */
type DocumentComparator<AppModelType, DbModelType extends firestore.DocumentData> = (l: QueryDocumentSnapshot<AppModelType, DbModelType>, r: QueryDocumentSnapshot<AppModelType, DbModelType>) => number;
/**
 * Watch provides listen functionality and exposes the 'onSnapshot' observer. It
 * can be used with a valid Firestore Listen target.
 *
 * @class
 * @private
 * @internal
 */
declare abstract class Watch<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> {
    readonly _converter: firestore.FirestoreDataConverter<AppModelType, DbModelType>;
    protected readonly firestore: Firestore;
    private readonly backoff;
    private readonly requestTag;
    /**
     * Indicates whether we are interested in data from the stream. Set to false in the
     * 'unsubscribe()' callback.
     * @private
     * @internal
     */
    private isActive;
    /**
     * The current stream to the backend.
     * @private
     * @internal
     */
    private currentStream;
    /**
     * The server assigns and updates the resume token.
     * @private
     * @internal
     */
    private resumeToken;
    /**
     * A map of document names to QueryDocumentSnapshots for the last sent snapshot.
     * @private
     * @internal
     */
    private docMap;
    /**
     * The accumulated map of document changes (keyed by document name) for the
     * current snapshot.
     * @private
     * @internal
     */
    private changeMap;
    /**
     * The current state of the query results. *
     * @private
     * @internal
     */
    private current;
    /**
     * The sorted tree of QueryDocumentSnapshots as sent in the last snapshot.
     * We only look at the keys.
     * @private
     * @internal
     */
    private docTree;
    /**
     * We need this to track whether we've pushed an initial set of changes,
     * since we should push those even when there are no changes, if there
     * aren't docs.
     * @private
     * @internal
     */
    private hasPushed;
    /**
     * The handler used to restart the Watch stream if it has been idle for more
     * than WATCH_IDLE_TIMEOUT_MS.
     */
    private idleTimeoutHandle?;
    private onNext;
    private onError;
    /**
     * @private
     * @internal
     *
     * @param firestore The Firestore Database client.
     */
    constructor(firestore: Firestore, _converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>);
    /**  Returns a 'Target' proto denoting the target to listen on. */
    protected abstract getTarget(resumeToken?: Uint8Array): api.ITarget;
    /**
     * Returns a comparator for QueryDocumentSnapshots that is used to order the
     * document snapshots returned by this watch.
     */
    protected abstract getComparator(): DocumentComparator<AppModelType, DbModelType>;
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
    onSnapshot(onNext: (readTime: Timestamp, size: number, docs: () => Array<QueryDocumentSnapshot<AppModelType, DbModelType>>, changes: () => Array<DocumentChange<AppModelType, DbModelType>>) => void, onError: (error: Error) => void): () => void;
    /**
     * Returns the current count of all documents, including the changes from
     * the current changeMap.
     * @private
     * @internal
     */
    private currentSize;
    /**
     * Splits up document changes into removals, additions, and updates.
     * @private
     * @internal
     */
    private extractCurrentChanges;
    /**
     * Helper to clear the docs on RESET or filter mismatch.
     * @private
     * @internal
     */
    private resetDocs;
    /**
     * Closes the stream and calls onError() if the stream is still active.
     * @private
     * @internal
     */
    private closeStream;
    /**
     * Re-opens the stream unless the specified error is considered permanent.
     * Clears the change map.
     * @private
     * @internal
     */
    private maybeReopenStream;
    /**
     * Cancels the current idle timeout and reschedules a new timer.
     *
     * @private
     * @internal
     */
    private resetIdleTimeout;
    /**
     * Helper to restart the outgoing stream to the backend.
     * @private
     * @internal
     */
    private resetStream;
    /**
     * Initializes a new stream to the backend with backoff.
     * @private
     * @internal
     */
    private initStream;
    /**
     * Handles 'data' events and closes the stream if the response type is
     * invalid.
     * @private
     * @internal
     */
    private onData;
    /**
     * Checks if the current target id is included in the list of target ids.
     * If no targetIds are provided, returns true.
     * @private
     * @internal
     */
    private affectsTarget;
    /**
     * Assembles a new snapshot from the current set of changes and invokes the
     * user's callback. Clears the current changes on completion.
     * @private
     * @internal
     */
    private pushSnapshot;
    /**
     * Applies a document delete to the document tree and the document map.
     * Returns the corresponding DocumentChange event.
     * @private
     * @internal
     */
    private deleteDoc;
    /**
     * Applies a document add to the document tree and the document map. Returns
     * the corresponding DocumentChange event.
     * @private
     * @internal
     */
    private addDoc;
    /**
     * Applies a document modification to the document tree and the document map.
     * Returns the DocumentChange event for successful modifications.
     * @private
     * @internal
     */
    private modifyDoc;
    /**
     * Applies the mutations in changeMap to both the document tree and the
     * document lookup map. Modified docMap in-place and returns the updated
     * state.
     * @private
     * @internal
     */
    private computeSnapshot;
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
    private isPermanentWatchError;
    /**
     * Determines whether we need to initiate a longer backoff due to system
     * overload.
     *
     * @private
     * @internal
     * @param error A GRPC Error object that exposes an error code.
     * @return Whether we need to back off our retries.
     */
    private isResourceExhaustedError;
    /** Closes the stream and clears all timeouts. */
    private shutdown;
}
/**
 * Creates a new Watch instance to listen on DocumentReferences.
 *
 * @private
 * @internal
 */
export declare class DocumentWatch<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> extends Watch<AppModelType, DbModelType> {
    private readonly ref;
    constructor(firestore: Firestore, ref: DocumentReference<AppModelType, DbModelType>);
    getComparator(): DocumentComparator<AppModelType, DbModelType>;
    getTarget(resumeToken?: Uint8Array): google.firestore.v1.ITarget;
}
/**
 * Creates a new Watch instance to listen on Queries.
 *
 * @private
 * @internal
 */
export declare class QueryWatch<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> extends Watch<AppModelType, DbModelType> {
    private readonly query;
    private comparator;
    constructor(firestore: Firestore, query: Query<AppModelType, DbModelType>, converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>);
    getComparator(): DocumentComparator<AppModelType, DbModelType>;
    getTarget(resumeToken?: Uint8Array): google.firestore.v1.ITarget;
}
export {};
