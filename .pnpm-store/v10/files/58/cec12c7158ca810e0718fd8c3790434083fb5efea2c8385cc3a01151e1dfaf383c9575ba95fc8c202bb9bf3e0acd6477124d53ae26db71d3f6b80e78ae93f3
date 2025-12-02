/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ReferenceConstructor } from '../api/Reference';
import { Node } from './snap/Node';
import { SyncPoint } from './SyncPoint';
import { ImmutableTree } from './util/ImmutableTree';
import { Path } from './util/Path';
import { Event } from './view/Event';
import { EventRegistration, QueryContext } from './view/EventRegistration';
import { WriteTree } from './WriteTree';
export declare function syncTreeSetReferenceConstructor(val: ReferenceConstructor): void;
export interface ListenProvider {
    startListening(query: QueryContext, tag: number | null, hashFn: () => string, onComplete: (a: string, b?: unknown) => Event[]): Event[];
    stopListening(a: QueryContext, b: number | null): void;
}
export declare function resetSyncTreeTag(): void;
/**
 * SyncTree is the central class for managing event callback registration, data caching, views
 * (query processing), and event generation.  There are typically two SyncTree instances for
 * each Repo, one for the normal Firebase data, and one for the .info data.
 *
 * It has a number of responsibilities, including:
 *  - Tracking all user event callbacks (registered via addEventRegistration() and removeEventRegistration()).
 *  - Applying and caching data changes for user set(), transaction(), and update() calls
 *    (applyUserOverwrite(), applyUserMerge()).
 *  - Applying and caching data changes for server data changes (applyServerOverwrite(),
 *    applyServerMerge()).
 *  - Generating user-facing events for server and user changes (all of the apply* methods
 *    return the set of events that need to be raised as a result).
 *  - Maintaining the appropriate set of server listens to ensure we are always subscribed
 *    to the correct set of paths and queries to satisfy the current set of user event
 *    callbacks (listens are started/stopped using the provided listenProvider).
 *
 * NOTE: Although SyncTree tracks event callbacks and calculates events to raise, the actual
 * events are returned to the caller rather than raised synchronously.
 *
 */
export declare class SyncTree {
    listenProvider_: ListenProvider;
    /**
     * Tree of SyncPoints.  There's a SyncPoint at any location that has 1 or more views.
     */
    syncPointTree_: ImmutableTree<SyncPoint>;
    /**
     * A tree of all pending user writes (user-initiated set()'s, transaction()'s, update()'s, etc.).
     */
    pendingWriteTree_: WriteTree;
    readonly tagToQueryMap: Map<number, string>;
    readonly queryToTagMap: Map<string, number>;
    /**
     * @param listenProvider_ - Used by SyncTree to start / stop listening
     *   to server data.
     */
    constructor(listenProvider_: ListenProvider);
}
/**
 * Apply the data changes for a user-generated set() or transaction() call.
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyUserOverwrite(syncTree: SyncTree, path: Path, newData: Node, writeId: number, visible?: boolean): Event[];
/**
 * Apply the data from a user-generated update() call
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyUserMerge(syncTree: SyncTree, path: Path, changedChildren: {
    [k: string]: Node;
}, writeId: number): Event[];
/**
 * Acknowledge a pending user write that was previously registered with applyUserOverwrite() or applyUserMerge().
 *
 * @param revert - True if the given write failed and needs to be reverted
 * @returns Events to raise.
 */
export declare function syncTreeAckUserWrite(syncTree: SyncTree, writeId: number, revert?: boolean): Event[];
/**
 * Apply new server data for the specified path..
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyServerOverwrite(syncTree: SyncTree, path: Path, newData: Node): Event[];
/**
 * Apply new server data to be merged in at the specified path.
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyServerMerge(syncTree: SyncTree, path: Path, changedChildren: {
    [k: string]: Node;
}): Event[];
/**
 * Apply a listen complete for a query
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyListenComplete(syncTree: SyncTree, path: Path): Event[];
/**
 * Apply a listen complete for a tagged query
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyTaggedListenComplete(syncTree: SyncTree, path: Path, tag: number): Event[];
/**
 * Remove event callback(s).
 *
 * If query is the default query, we'll check all queries for the specified eventRegistration.
 * If eventRegistration is null, we'll remove all callbacks for the specified query/queries.
 *
 * @param eventRegistration - If null, all callbacks are removed.
 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
 * @param skipListenerDedup - When performing a `get()`, we don't add any new listeners, so no
 *  deduping needs to take place. This flag allows toggling of that behavior
 * @returns Cancel events, if cancelError was provided.
 */
export declare function syncTreeRemoveEventRegistration(syncTree: SyncTree, query: QueryContext, eventRegistration: EventRegistration | null, cancelError?: Error, skipListenerDedup?: boolean): Event[];
/**
 * Apply new server data for the specified tagged query.
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyTaggedQueryOverwrite(syncTree: SyncTree, path: Path, snap: Node, tag: number): Event[];
/**
 * Apply server data to be merged in for the specified tagged query.
 *
 * @returns Events to raise.
 */
export declare function syncTreeApplyTaggedQueryMerge(syncTree: SyncTree, path: Path, changedChildren: {
    [k: string]: Node;
}, tag: number): Event[];
/**
 * Add an event callback for the specified query.
 *
 * @returns Events to raise.
 */
export declare function syncTreeAddEventRegistration(syncTree: SyncTree, query: QueryContext, eventRegistration: EventRegistration, skipSetupListener?: boolean): Event[];
/**
 * Returns a complete cache, if we have one, of the data at a particular path. If the location does not have a
 * listener above it, we will get a false "null". This shouldn't be a problem because transactions will always
 * have a listener above, and atomic operations would correctly show a jitter of <increment value> ->
 *     <incremented total> as the write is applied locally and then acknowledged at the server.
 *
 * Note: this method will *include* hidden writes from transaction with applyLocally set to false.
 *
 * @param path - The path to the data we want
 * @param writeIdsToExclude - A specific set to be excluded
 */
export declare function syncTreeCalcCompleteEventCache(syncTree: SyncTree, path: Path, writeIdsToExclude?: number[]): Node;
export declare function syncTreeGetServerValue(syncTree: SyncTree, query: QueryContext): Node | null;
/**
 * Return the tag associated with the given query.
 */
export declare function syncTreeTagForQuery(syncTree: SyncTree, query: QueryContext): number | null;
