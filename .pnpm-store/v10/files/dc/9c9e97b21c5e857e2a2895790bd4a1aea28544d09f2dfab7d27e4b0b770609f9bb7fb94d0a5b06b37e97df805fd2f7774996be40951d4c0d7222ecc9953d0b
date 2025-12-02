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
import { Operation } from './operation/Operation';
import { Node } from './snap/Node';
import { Path } from './util/Path';
import { Event } from './view/Event';
import { EventRegistration, QueryContext } from './view/EventRegistration';
import { View } from './view/View';
import { WriteTreeRef } from './WriteTree';
/**
 * SyncPoint represents a single location in a SyncTree with 1 or more event registrations, meaning we need to
 * maintain 1 or more Views at this location to cache server data and raise appropriate events for server changes
 * and user writes (set, transaction, update).
 *
 * It's responsible for:
 *  - Maintaining the set of 1 or more views necessary at this location (a SyncPoint with 0 views should be removed).
 *  - Proxying user / server operations to the views as appropriate (i.e. applyServerOverwrite,
 *    applyUserOverwrite, etc.)
 */
export declare class SyncPoint {
    /**
     * The Views being tracked at this location in the tree, stored as a map where the key is a
     * queryId and the value is the View for that query.
     *
     * NOTE: This list will be quite small (usually 1, but perhaps 2 or 3; any more is an odd use case).
     */
    readonly views: Map<string, View>;
}
export declare function syncPointSetReferenceConstructor(val: ReferenceConstructor): void;
export declare function syncPointIsEmpty(syncPoint: SyncPoint): boolean;
export declare function syncPointApplyOperation(syncPoint: SyncPoint, operation: Operation, writesCache: WriteTreeRef, optCompleteServerCache: Node | null): Event[];
/**
 * Get a view for the specified query.
 *
 * @param query - The query to return a view for
 * @param writesCache
 * @param serverCache
 * @param serverCacheComplete
 * @returns Events to raise.
 */
export declare function syncPointGetView(syncPoint: SyncPoint, query: QueryContext, writesCache: WriteTreeRef, serverCache: Node | null, serverCacheComplete: boolean): View;
/**
 * Add an event callback for the specified query.
 *
 * @param query
 * @param eventRegistration
 * @param writesCache
 * @param serverCache - Complete server cache, if we have it.
 * @param serverCacheComplete
 * @returns Events to raise.
 */
export declare function syncPointAddEventRegistration(syncPoint: SyncPoint, query: QueryContext, eventRegistration: EventRegistration, writesCache: WriteTreeRef, serverCache: Node | null, serverCacheComplete: boolean): Event[];
/**
 * Remove event callback(s).  Return cancelEvents if a cancelError is specified.
 *
 * If query is the default query, we'll check all views for the specified eventRegistration.
 * If eventRegistration is null, we'll remove all callbacks for the specified view(s).
 *
 * @param eventRegistration - If null, remove all callbacks.
 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
 * @returns removed queries and any cancel events
 */
export declare function syncPointRemoveEventRegistration(syncPoint: SyncPoint, query: QueryContext, eventRegistration: EventRegistration | null, cancelError?: Error): {
    removed: QueryContext[];
    events: Event[];
};
export declare function syncPointGetQueryViews(syncPoint: SyncPoint): View[];
/**
 * @param path - The path to the desired complete snapshot
 * @returns A complete cache, if it exists
 */
export declare function syncPointGetCompleteServerCache(syncPoint: SyncPoint, path: Path): Node | null;
export declare function syncPointViewForQuery(syncPoint: SyncPoint, query: QueryContext): View | null;
export declare function syncPointViewExistsForQuery(syncPoint: SyncPoint, query: QueryContext): boolean;
export declare function syncPointHasCompleteView(syncPoint: SyncPoint): boolean;
export declare function syncPointGetCompleteView(syncPoint: SyncPoint): View | null;
