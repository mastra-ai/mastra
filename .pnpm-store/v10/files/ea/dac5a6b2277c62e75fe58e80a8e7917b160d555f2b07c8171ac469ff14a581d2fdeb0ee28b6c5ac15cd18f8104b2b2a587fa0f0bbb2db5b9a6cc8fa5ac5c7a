/**
 * @license
 * Copyright 2020 Google LLC
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
import { Repo } from '../core/Repo';
import { Index } from '../core/snap/indexes/Index';
import { Node } from '../core/snap/Node';
import { Path } from '../core/util/Path';
import { Change } from '../core/view/Change';
import { CancelEvent, DataEvent, EventType } from '../core/view/Event';
import { CallbackContext, EventRegistration, QueryContext } from '../core/view/EventRegistration';
import { QueryParams } from '../core/view/QueryParams';
import { Database } from './Database';
import { OnDisconnect } from './OnDisconnect';
import { ListenOptions, Query as Query, DatabaseReference, Unsubscribe, ThenableReference } from './Reference';
/**
 * @internal
 */
export declare class QueryImpl implements Query, QueryContext {
    readonly _repo: Repo;
    readonly _path: Path;
    readonly _queryParams: QueryParams;
    readonly _orderByCalled: boolean;
    /**
     * @hideconstructor
     */
    constructor(_repo: Repo, _path: Path, _queryParams: QueryParams, _orderByCalled: boolean);
    get key(): string | null;
    get ref(): DatabaseReference;
    get _queryIdentifier(): string;
    /**
     * An object representation of the query parameters used by this Query.
     */
    get _queryObject(): object;
    isEqual(other: QueryImpl | null): boolean;
    toJSON(): string;
    toString(): string;
}
/**
 * @internal
 */
export declare class ReferenceImpl extends QueryImpl implements DatabaseReference {
    /** @hideconstructor */
    constructor(repo: Repo, path: Path);
    get parent(): ReferenceImpl | null;
    get root(): ReferenceImpl;
}
/**
 * A `DataSnapshot` contains data from a Database location.
 *
 * Any time you read data from the Database, you receive the data as a
 * `DataSnapshot`. A `DataSnapshot` is passed to the event callbacks you attach
 * with `on()` or `once()`. You can extract the contents of the snapshot as a
 * JavaScript object by calling the `val()` method. Alternatively, you can
 * traverse into the snapshot by calling `child()` to return child snapshots
 * (which you could then call `val()` on).
 *
 * A `DataSnapshot` is an efficiently generated, immutable copy of the data at
 * a Database location. It cannot be modified and will never change (to modify
 * data, you always call the `set()` method on a `Reference` directly).
 */
export declare class DataSnapshot {
    readonly _node: Node;
    /**
     * The location of this DataSnapshot.
     */
    readonly ref: DatabaseReference;
    readonly _index: Index;
    /**
     * @param _node - A SnapshotNode to wrap.
     * @param ref - The location this snapshot came from.
     * @param _index - The iteration order for this snapshot
     * @hideconstructor
     */
    constructor(_node: Node, 
    /**
     * The location of this DataSnapshot.
     */
    ref: DatabaseReference, _index: Index);
    /**
     * Gets the priority value of the data in this `DataSnapshot`.
     *
     * Applications need not use priority but can order collections by
     * ordinary properties (see
     * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data |Sorting and filtering data}
     * ).
     */
    get priority(): string | number | null;
    /**
     * The key (last part of the path) of the location of this `DataSnapshot`.
     *
     * The last token in a Database location is considered its key. For example,
     * "ada" is the key for the /users/ada/ node. Accessing the key on any
     * `DataSnapshot` will return the key for the location that generated it.
     * However, accessing the key on the root URL of a Database will return
     * `null`.
     */
    get key(): string | null;
    /** Returns the number of child properties of this `DataSnapshot`. */
    get size(): number;
    /**
     * Gets another `DataSnapshot` for the location at the specified relative path.
     *
     * Passing a relative path to the `child()` method of a DataSnapshot returns
     * another `DataSnapshot` for the location at the specified relative path. The
     * relative path can either be a simple child name (for example, "ada") or a
     * deeper, slash-separated path (for example, "ada/name/first"). If the child
     * location has no data, an empty `DataSnapshot` (that is, a `DataSnapshot`
     * whose value is `null`) is returned.
     *
     * @param path - A relative path to the location of child data.
     */
    child(path: string): DataSnapshot;
    /**
     * Returns true if this `DataSnapshot` contains any data. It is slightly more
     * efficient than using `snapshot.val() !== null`.
     */
    exists(): boolean;
    /**
     * Exports the entire contents of the DataSnapshot as a JavaScript object.
     *
     * The `exportVal()` method is similar to `val()`, except priority information
     * is included (if available), making it suitable for backing up your data.
     *
     * @returns The DataSnapshot's contents as a JavaScript value (Object,
     *   Array, string, number, boolean, or `null`).
     */
    exportVal(): any;
    /**
     * Enumerates the top-level children in the `IteratedDataSnapshot`.
     *
     * Because of the way JavaScript objects work, the ordering of data in the
     * JavaScript object returned by `val()` is not guaranteed to match the
     * ordering on the server nor the ordering of `onChildAdded()` events. That is
     * where `forEach()` comes in handy. It guarantees the children of a
     * `DataSnapshot` will be iterated in their query order.
     *
     * If no explicit `orderBy*()` method is used, results are returned
     * ordered by key (unless priorities are used, in which case, results are
     * returned by priority).
     *
     * @param action - A function that will be called for each child DataSnapshot.
     * The callback can return true to cancel further enumeration.
     * @returns true if enumeration was canceled due to your callback returning
     * true.
     */
    forEach(action: (child: IteratedDataSnapshot) => boolean | void): boolean;
    /**
     * Returns true if the specified child path has (non-null) data.
     *
     * @param path - A relative path to the location of a potential child.
     * @returns `true` if data exists at the specified child path; else
     *  `false`.
     */
    hasChild(path: string): boolean;
    /**
     * Returns whether or not the `DataSnapshot` has any non-`null` child
     * properties.
     *
     * You can use `hasChildren()` to determine if a `DataSnapshot` has any
     * children. If it does, you can enumerate them using `forEach()`. If it
     * doesn't, then either this snapshot contains a primitive value (which can be
     * retrieved with `val()`) or it is empty (in which case, `val()` will return
     * `null`).
     *
     * @returns true if this snapshot has any children; else false.
     */
    hasChildren(): boolean;
    /**
     * Returns a JSON-serializable representation of this object.
     */
    toJSON(): object | null;
    /**
     * Extracts a JavaScript value from a `DataSnapshot`.
     *
     * Depending on the data in a `DataSnapshot`, the `val()` method may return a
     * scalar type (string, number, or boolean), an array, or an object. It may
     * also return null, indicating that the `DataSnapshot` is empty (contains no
     * data).
     *
     * @returns The DataSnapshot's contents as a JavaScript value (Object,
     *   Array, string, number, boolean, or `null`).
     */
    val(): any;
}
/**
 * Represents a child snapshot of a `Reference` that is being iterated over. The key will never be undefined.
 */
export interface IteratedDataSnapshot extends DataSnapshot {
    key: string;
}
/**
 *
 * Returns a `Reference` representing the location in the Database
 * corresponding to the provided path. If no path is provided, the `Reference`
 * will point to the root of the Database.
 *
 * @param db - The database instance to obtain a reference for.
 * @param path - Optional path representing the location the returned
 *   `Reference` will point. If not provided, the returned `Reference` will
 *   point to the root of the Database.
 * @returns If a path is provided, a `Reference`
 *   pointing to the provided path. Otherwise, a `Reference` pointing to the
 *   root of the Database.
 */
export declare function ref(db: Database, path?: string): DatabaseReference;
/**
 * Returns a `Reference` representing the location in the Database
 * corresponding to the provided Firebase URL.
 *
 * An exception is thrown if the URL is not a valid Firebase Database URL or it
 * has a different domain than the current `Database` instance.
 *
 * Note that all query parameters (`orderBy`, `limitToLast`, etc.) are ignored
 * and are not applied to the returned `Reference`.
 *
 * @param db - The database instance to obtain a reference for.
 * @param url - The Firebase URL at which the returned `Reference` will
 *   point.
 * @returns A `Reference` pointing to the provided
 *   Firebase URL.
 */
export declare function refFromURL(db: Database, url: string): DatabaseReference;
/**
 * Gets a `Reference` for the location at the specified relative path.
 *
 * The relative path can either be a simple child name (for example, "ada") or
 * a deeper slash-separated path (for example, "ada/name/first").
 *
 * @param parent - The parent location.
 * @param path - A relative path from this location to the desired child
 *   location.
 * @returns The specified child location.
 */
export declare function child(parent: DatabaseReference, path: string): DatabaseReference;
/**
 * Returns an `OnDisconnect` object - see
 * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
 * for more information on how to use it.
 *
 * @param ref - The reference to add OnDisconnect triggers for.
 */
export declare function onDisconnect(ref: DatabaseReference): OnDisconnect;
export interface ThenableReferenceImpl extends ReferenceImpl, Pick<Promise<ReferenceImpl>, 'then' | 'catch'> {
    key: string;
    parent: ReferenceImpl;
}
/**
 * Generates a new child location using a unique key and returns its
 * `Reference`.
 *
 * This is the most common pattern for adding data to a collection of items.
 *
 * If you provide a value to `push()`, the value is written to the
 * generated location. If you don't pass a value, nothing is written to the
 * database and the child remains empty (but you can use the `Reference`
 * elsewhere).
 *
 * The unique keys generated by `push()` are ordered by the current time, so the
 * resulting list of items is chronologically sorted. The keys are also
 * designed to be unguessable (they contain 72 random bits of entropy).
 *
 * See {@link https://firebase.google.com/docs/database/web/lists-of-data#append_to_a_list_of_data | Append to a list of data}.
 * See {@link https://firebase.googleblog.com/2015/02/the-2120-ways-to-ensure-unique_68.html | The 2^120 Ways to Ensure Unique Identifiers}.
 *
 * @param parent - The parent location.
 * @param value - Optional value to be written at the generated location.
 * @returns Combined `Promise` and `Reference`; resolves when write is complete,
 * but can be used immediately as the `Reference` to the child location.
 */
export declare function push(parent: DatabaseReference, value?: unknown): ThenableReference;
/**
 * Removes the data at this Database location.
 *
 * Any data at child locations will also be deleted.
 *
 * The effect of the remove will be visible immediately and the corresponding
 * event 'value' will be triggered. Synchronization of the remove to the
 * Firebase servers will also be started, and the returned Promise will resolve
 * when complete. If provided, the onComplete callback will be called
 * asynchronously after synchronization has finished.
 *
 * @param ref - The location to remove.
 * @returns Resolves when remove on server is complete.
 */
export declare function remove(ref: DatabaseReference): Promise<void>;
/**
 * Writes data to this Database location.
 *
 * This will overwrite any data at this location and all child locations.
 *
 * The effect of the write will be visible immediately, and the corresponding
 * events ("value", "child_added", etc.) will be triggered. Synchronization of
 * the data to the Firebase servers will also be started, and the returned
 * Promise will resolve when complete. If provided, the `onComplete` callback
 * will be called asynchronously after synchronization has finished.
 *
 * Passing `null` for the new value is equivalent to calling `remove()`; namely,
 * all data at this location and all child locations will be deleted.
 *
 * `set()` will remove any priority stored at this location, so if priority is
 * meant to be preserved, you need to use `setWithPriority()` instead.
 *
 * Note that modifying data with `set()` will cancel any pending transactions
 * at that location, so extreme care should be taken if mixing `set()` and
 * `transaction()` to modify the same data.
 *
 * A single `set()` will generate a single "value" event at the location where
 * the `set()` was performed.
 *
 * @param ref - The location to write to.
 * @param value - The value to be written (string, number, boolean, object,
 *   array, or null).
 * @returns Resolves when write to server is complete.
 */
export declare function set(ref: DatabaseReference, value: unknown): Promise<void>;
/**
 * Sets a priority for the data at this Database location.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data | Sorting and filtering data}
 * ).
 *
 * @param ref - The location to write to.
 * @param priority - The priority to be written (string, number, or null).
 * @returns Resolves when write to server is complete.
 */
export declare function setPriority(ref: DatabaseReference, priority: string | number | null): Promise<void>;
/**
 * Writes data the Database location. Like `set()` but also specifies the
 * priority for that data.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data | Sorting and filtering data}
 * ).
 *
 * @param ref - The location to write to.
 * @param value - The value to be written (string, number, boolean, object,
 *   array, or null).
 * @param priority - The priority to be written (string, number, or null).
 * @returns Resolves when write to server is complete.
 */
export declare function setWithPriority(ref: DatabaseReference, value: unknown, priority: string | number | null): Promise<void>;
/**
 * Writes multiple values to the Database at once.
 *
 * The `values` argument contains multiple property-value pairs that will be
 * written to the Database together. Each child property can either be a simple
 * property (for example, "name") or a relative path (for example,
 * "name/first") from the current location to the data to update.
 *
 * As opposed to the `set()` method, `update()` can be use to selectively update
 * only the referenced properties at the current location (instead of replacing
 * all the child properties at the current location).
 *
 * The effect of the write will be visible immediately, and the corresponding
 * events ('value', 'child_added', etc.) will be triggered. Synchronization of
 * the data to the Firebase servers will also be started, and the returned
 * Promise will resolve when complete. If provided, the `onComplete` callback
 * will be called asynchronously after synchronization has finished.
 *
 * A single `update()` will generate a single "value" event at the location
 * where the `update()` was performed, regardless of how many children were
 * modified.
 *
 * Note that modifying data with `update()` will cancel any pending
 * transactions at that location, so extreme care should be taken if mixing
 * `update()` and `transaction()` to modify the same data.
 *
 * Passing `null` to `update()` will remove the data at this location.
 *
 * See
 * {@link https://firebase.googleblog.com/2015/09/introducing-multi-location-updates-and_86.html | Introducing multi-location updates and more}.
 *
 * @param ref - The location to write to.
 * @param values - Object containing multiple values.
 * @returns Resolves when update on server is complete.
 */
export declare function update(ref: DatabaseReference, values: object): Promise<void>;
/**
 * Gets the most up-to-date result for this query.
 *
 * @param query - The query to run.
 * @returns A `Promise` which resolves to the resulting DataSnapshot if a value is
 * available, or rejects if the client is unable to return a value (e.g., if the
 * server is unreachable and there is nothing cached).
 */
export declare function get(query: Query): Promise<DataSnapshot>;
/**
 * Represents registration for 'value' events.
 */
export declare class ValueEventRegistration implements EventRegistration {
    private callbackContext;
    constructor(callbackContext: CallbackContext);
    respondsTo(eventType: string): boolean;
    createEvent(change: Change, query: QueryContext): DataEvent;
    getEventRunner(eventData: CancelEvent | DataEvent): () => void;
    createCancelEvent(error: Error, path: Path): CancelEvent | null;
    matches(other: EventRegistration): boolean;
    hasAnyCallback(): boolean;
}
/**
 * Represents the registration of a child_x event.
 */
export declare class ChildEventRegistration implements EventRegistration {
    private eventType;
    private callbackContext;
    constructor(eventType: string, callbackContext: CallbackContext | null);
    respondsTo(eventType: string): boolean;
    createCancelEvent(error: Error, path: Path): CancelEvent | null;
    createEvent(change: Change, query: QueryContext): DataEvent;
    getEventRunner(eventData: CancelEvent | DataEvent): () => void;
    matches(other: EventRegistration): boolean;
    hasAnyCallback(): boolean;
}
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onValue` event will trigger once with the initial data stored at this
 * location, and then trigger again each time the data changes. The
 * `DataSnapshot` passed to the callback will be for the location at which
 * `on()` was called. It won't trigger until the entire contents has been
 * synchronized. If the location has no data, it will be triggered with an empty
 * `DataSnapshot` (`val()` will return `null`).
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs. The
 * callback will be passed a DataSnapshot.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onValue(query: Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onValue` event will trigger once with the initial data stored at this
 * location, and then trigger again each time the data changes. The
 * `DataSnapshot` passed to the callback will be for the location at which
 * `on()` was called. It won't trigger until the entire contents has been
 * synchronized. If the location has no data, it will be triggered with an empty
 * `DataSnapshot` (`val()` will return `null`).
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs. The
 * callback will be passed a DataSnapshot.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onValue(query: Query, callback: (snapshot: DataSnapshot) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onValue` event will trigger once with the initial data stored at this
 * location, and then trigger again each time the data changes. The
 * `DataSnapshot` passed to the callback will be for the location at which
 * `on()` was called. It won't trigger until the entire contents has been
 * synchronized. If the location has no data, it will be triggered with an empty
 * `DataSnapshot` (`val()` will return `null`).
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs. The
 * callback will be passed a DataSnapshot.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onValue(query: Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildAdded` event will be triggered once for each initial child at this
 * location, and it will be triggered again every time a new child is added. The
 * `DataSnapshot` passed into the callback will reflect the data for the
 * relevant child. For ordering purposes, it is passed a second argument which
 * is a string containing the key of the previous sibling child by sort order,
 * or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildAdded(query: Query, callback: (snapshot: DataSnapshot, previousChildName?: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildAdded` event will be triggered once for each initial child at this
 * location, and it will be triggered again every time a new child is added. The
 * `DataSnapshot` passed into the callback will reflect the data for the
 * relevant child. For ordering purposes, it is passed a second argument which
 * is a string containing the key of the previous sibling child by sort order,
 * or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildAdded(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildAdded` event will be triggered once for each initial child at this
 * location, and it will be triggered again every time a new child is added. The
 * `DataSnapshot` passed into the callback will reflect the data for the
 * relevant child. For ordering purposes, it is passed a second argument which
 * is a string containing the key of the previous sibling child by sort order,
 * or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildAdded(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildChanged` event will be triggered when the data stored in a child
 * (or any of its descendants) changes. Note that a single `child_changed` event
 * may represent multiple changes to the child. The `DataSnapshot` passed to the
 * callback will contain the new child contents. For ordering purposes, the
 * callback is also passed a second argument which is a string containing the
 * key of the previous sibling child by sort order, or `null` if it is the first
 * child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildChanged(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildChanged` event will be triggered when the data stored in a child
 * (or any of its descendants) changes. Note that a single `child_changed` event
 * may represent multiple changes to the child. The `DataSnapshot` passed to the
 * callback will contain the new child contents. For ordering purposes, the
 * callback is also passed a second argument which is a string containing the
 * key of the previous sibling child by sort order, or `null` if it is the first
 * child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildChanged(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildChanged` event will be triggered when the data stored in a child
 * (or any of its descendants) changes. Note that a single `child_changed` event
 * may represent multiple changes to the child. The `DataSnapshot` passed to the
 * callback will contain the new child contents. For ordering purposes, the
 * callback is also passed a second argument which is a string containing the
 * key of the previous sibling child by sort order, or `null` if it is the first
 * child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildChanged(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildMoved` event will be triggered when a child's sort order changes
 * such that its position relative to its siblings changes. The `DataSnapshot`
 * passed to the callback will be for the data of the child that has moved. It
 * is also passed a second argument which is a string containing the key of the
 * previous sibling child by sort order, or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildMoved(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildMoved` event will be triggered when a child's sort order changes
 * such that its position relative to its siblings changes. The `DataSnapshot`
 * passed to the callback will be for the data of the child that has moved. It
 * is also passed a second argument which is a string containing the key of the
 * previous sibling child by sort order, or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildMoved(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildMoved` event will be triggered when a child's sort order changes
 * such that its position relative to its siblings changes. The `DataSnapshot`
 * passed to the callback will be for the data of the child that has moved. It
 * is also passed a second argument which is a string containing the key of the
 * previous sibling child by sort order, or `null` if it is the first child.
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildMoved(query: Query, callback: (snapshot: DataSnapshot, previousChildName: string | null) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildRemoved` event will be triggered once every time a child is
 * removed. The `DataSnapshot` passed into the callback will be the old data for
 * the child that was removed. A child will get removed when either:
 *
 * - a client explicitly calls `remove()` on that child or one of its ancestors
 * - a client calls `set(null)` on that child or one of its ancestors
 * - that child has all of its children removed
 * - there is a query in effect which now filters out the child (because it's
 *   sort order changed or the max limit was hit)
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildRemoved(query: Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback?: (error: Error) => unknown): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildRemoved` event will be triggered once every time a child is
 * removed. The `DataSnapshot` passed into the callback will be the old data for
 * the child that was removed. A child will get removed when either:
 *
 * - a client explicitly calls `remove()` on that child or one of its ancestors
 * - a client calls `set(null)` on that child or one of its ancestors
 * - that child has all of its children removed
 * - there is a query in effect which now filters out the child (because it's
 *   sort order changed or the max limit was hit)
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildRemoved(query: Query, callback: (snapshot: DataSnapshot) => unknown, options: ListenOptions): Unsubscribe;
/**
 * Listens for data changes at a particular location.
 *
 * This is the primary way to read data from a Database. Your callback
 * will be triggered for the initial data and again whenever the data changes.
 * Invoke the returned unsubscribe callback to stop receiving updates. See
 * {@link https://firebase.google.com/docs/database/web/retrieve-data | Retrieve Data on the Web}
 * for more details.
 *
 * An `onChildRemoved` event will be triggered once every time a child is
 * removed. The `DataSnapshot` passed into the callback will be the old data for
 * the child that was removed. A child will get removed when either:
 *
 * - a client explicitly calls `remove()` on that child or one of its ancestors
 * - a client calls `set(null)` on that child or one of its ancestors
 * - that child has all of its children removed
 * - there is a query in effect which now filters out the child (because it's
 *   sort order changed or the max limit was hit)
 *
 * @param query - The query to run.
 * @param callback - A callback that fires when the specified event occurs.
 * The callback will be passed a DataSnapshot and a string containing the key of
 * the previous child, by sort order, or `null` if it is the first child.
 * @param cancelCallback - An optional callback that will be notified if your
 * event subscription is ever canceled because your client does not have
 * permission to read this data (or it had permission but has now lost it).
 * This callback will be passed an `Error` object indicating why the failure
 * occurred.
 * @param options - An object that can be used to configure `onlyOnce`, which
 * then removes the listener after its first invocation.
 * @returns A function that can be invoked to remove the listener.
 */
export declare function onChildRemoved(query: Query, callback: (snapshot: DataSnapshot) => unknown, cancelCallback: (error: Error) => unknown, options: ListenOptions): Unsubscribe;
export { EventType };
/**
 * Detaches a callback previously attached with the corresponding `on*()` (`onValue`, `onChildAdded`) listener.
 * Note: This is not the recommended way to remove a listener. Instead, please use the returned callback function from
 * the respective `on*` callbacks.
 *
 * Detach a callback previously attached with `on*()`. Calling `off()` on a parent listener
 * will not automatically remove listeners registered on child nodes, `off()`
 * must also be called on any child listeners to remove the callback.
 *
 * If a callback is not specified, all callbacks for the specified eventType
 * will be removed. Similarly, if no eventType is specified, all callbacks
 * for the `Reference` will be removed.
 *
 * Individual listeners can also be removed by invoking their unsubscribe
 * callbacks.
 *
 * @param query - The query that the listener was registered with.
 * @param eventType - One of the following strings: "value", "child_added",
 * "child_changed", "child_removed", or "child_moved." If omitted, all callbacks
 * for the `Reference` will be removed.
 * @param callback - The callback function that was passed to `on()` or
 * `undefined` to remove all callbacks.
 */
export declare function off(query: Query, eventType?: EventType, callback?: (snapshot: DataSnapshot, previousChildName?: string | null) => unknown): void;
/** Describes the different query constraints available in this SDK. */
export type QueryConstraintType = 'endAt' | 'endBefore' | 'startAt' | 'startAfter' | 'limitToFirst' | 'limitToLast' | 'orderByChild' | 'orderByKey' | 'orderByPriority' | 'orderByValue' | 'equalTo';
/**
 * A `QueryConstraint` is used to narrow the set of documents returned by a
 * Database query. `QueryConstraint`s are created by invoking {@link endAt},
 * {@link endBefore}, {@link startAt}, {@link startAfter}, {@link
 * limitToFirst}, {@link limitToLast}, {@link orderByChild},
 * {@link orderByChild}, {@link orderByKey} , {@link orderByPriority} ,
 * {@link orderByValue}  or {@link equalTo} and
 * can then be passed to {@link query} to create a new query instance that
 * also contains this `QueryConstraint`.
 */
export declare abstract class QueryConstraint {
    /** The type of this query constraints */
    abstract readonly type: QueryConstraintType;
    /**
     * Takes the provided `Query` and returns a copy of the `Query` with this
     * `QueryConstraint` applied.
     */
    abstract _apply<T>(query: QueryImpl): QueryImpl;
}
/**
 * Creates a `QueryConstraint` with the specified ending point.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The ending point is inclusive, so children with exactly the specified value
 * will be included in the query. The optional key argument can be used to
 * further limit the range of the query. If it is specified, then children that
 * have exactly the specified value must also have a key name less than or equal
 * to the specified key.
 *
 * You can read more about `endAt()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to end at. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to end at, among the children with the previously
 * specified priority. This argument is only allowed if ordering by child,
 * value, or priority.
 */
export declare function endAt(value: number | string | boolean | null, key?: string): QueryConstraint;
/**
 * Creates a `QueryConstraint` with the specified ending point (exclusive).
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The ending point is exclusive. If only a value is provided, children
 * with a value less than the specified value will be included in the query.
 * If a key is specified, then children must have a value less than or equal
 * to the specified value and a key name less than the specified key.
 *
 * @param value - The value to end before. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to end before, among the children with the
 * previously specified priority. This argument is only allowed if ordering by
 * child, value, or priority.
 */
export declare function endBefore(value: number | string | boolean | null, key?: string): QueryConstraint;
/**
 * Creates a `QueryConstraint` with the specified starting point.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The starting point is inclusive, so children with exactly the specified value
 * will be included in the query. The optional key argument can be used to
 * further limit the range of the query. If it is specified, then children that
 * have exactly the specified value must also have a key name greater than or
 * equal to the specified key.
 *
 * You can read more about `startAt()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to start at. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start at. This argument is only allowed if
 * ordering by child, value, or priority.
 */
export declare function startAt(value?: number | string | boolean | null, key?: string): QueryConstraint;
/**
 * Creates a `QueryConstraint` with the specified starting point (exclusive).
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The starting point is exclusive. If only a value is provided, children
 * with a value greater than the specified value will be included in the query.
 * If a key is specified, then children must have a value greater than or equal
 * to the specified value and a a key name greater than the specified key.
 *
 * @param value - The value to start after. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start after. This argument is only allowed if
 * ordering by child, value, or priority.
 */
export declare function startAfter(value: number | string | boolean | null, key?: string): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that if limited to the first specific number
 * of children.
 *
 * The `limitToFirst()` method is used to set a maximum number of children to be
 * synced for a given callback. If we set a limit of 100, we will initially only
 * receive up to 100 `child_added` events. If we have fewer than 100 messages
 * stored in our Database, a `child_added` event will fire for each message.
 * However, if we have over 100 messages, we will only receive a `child_added`
 * event for the first 100 ordered messages. As items change, we will receive
 * `child_removed` events for each item that drops out of the active list so
 * that the total number stays at 100.
 *
 * You can read more about `limitToFirst()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param limit - The maximum number of nodes to include in this query.
 */
export declare function limitToFirst(limit: number): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that is limited to return only the last
 * specified number of children.
 *
 * The `limitToLast()` method is used to set a maximum number of children to be
 * synced for a given callback. If we set a limit of 100, we will initially only
 * receive up to 100 `child_added` events. If we have fewer than 100 messages
 * stored in our Database, a `child_added` event will fire for each message.
 * However, if we have over 100 messages, we will only receive a `child_added`
 * event for the last 100 ordered messages. As items change, we will receive
 * `child_removed` events for each item that drops out of the active list so
 * that the total number stays at 100.
 *
 * You can read more about `limitToLast()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param limit - The maximum number of nodes to include in this query.
 */
export declare function limitToLast(limit: number): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that orders by the specified child key.
 *
 * Queries can only order by one key at a time. Calling `orderByChild()`
 * multiple times on the same query is an error.
 *
 * Firebase queries allow you to order your data by any child key on the fly.
 * However, if you know in advance what your indexes will be, you can define
 * them via the .indexOn rule in your Security Rules for better performance. See
 * the{@link https://firebase.google.com/docs/database/security/indexing-data}
 * rule for more information.
 *
 * You can read more about `orderByChild()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 *
 * @param path - The path to order by.
 */
export declare function orderByChild(path: string): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that orders by the key.
 *
 * Sorts the results of a query by their (ascending) key values.
 *
 * You can read more about `orderByKey()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 */
export declare function orderByKey(): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that orders by priority.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}
 * for alternatives to priority.
 */
export declare function orderByPriority(): QueryConstraint;
/**
 * Creates a new `QueryConstraint` that orders by value.
 *
 * If the children of a query are all scalar values (string, number, or
 * boolean), you can order the results by their (ascending) values.
 *
 * You can read more about `orderByValue()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 */
export declare function orderByValue(): QueryConstraint;
/**
 * Creates a `QueryConstraint` that includes children that match the specified
 * value.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The optional key argument can be used to further limit the range of the
 * query. If it is specified, then children that have exactly the specified
 * value must also have exactly the specified key as their key name. This can be
 * used to filter result sets with many matches for the same value.
 *
 * You can read more about `equalTo()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to match for. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start at, among the children with the
 * previously specified priority. This argument is only allowed if ordering by
 * child, value, or priority.
 */
export declare function equalTo(value: number | string | boolean | null, key?: string): QueryConstraint;
/**
 * Creates a new immutable instance of `Query` that is extended to also include
 * additional query constraints.
 *
 * @param query - The Query instance to use as a base for the new constraints.
 * @param queryConstraints - The list of `QueryConstraint`s to apply.
 * @throws if any of the provided query constraints cannot be combined with the
 * existing or new constraints.
 */
export declare function query(query: Query, ...queryConstraints: QueryConstraint[]): Query;
