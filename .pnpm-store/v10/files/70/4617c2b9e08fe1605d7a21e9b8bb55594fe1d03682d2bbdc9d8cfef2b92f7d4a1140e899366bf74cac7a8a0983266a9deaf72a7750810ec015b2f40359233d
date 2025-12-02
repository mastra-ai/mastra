/**
 * Firebase Realtime Database
 *
 * @packageDocumentation
 */

import { AppCheckInternalComponentName } from '@firebase/app-check-interop-types';
import { AppCheckTokenListener } from '@firebase/app-check-interop-types';
import { AppCheckTokenResult } from '@firebase/app-check-interop-types';
import { EmulatorMockTokenOptions } from '@firebase/util';
import { FirebaseApp } from '@firebase/app';
import { FirebaseApp as FirebaseApp_2 } from '@firebase/app-types';
import { FirebaseAppCheckInternal } from '@firebase/app-check-interop-types';
import { FirebaseAuthInternal } from '@firebase/auth-interop-types';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { FirebaseAuthTokenData } from '@firebase/app-types/private';
import { _FirebaseService } from '@firebase/app';
import { Provider } from '@firebase/component';

/**
 * Abstraction around AppCheck's token fetching capabilities.
 */
declare class AppCheckTokenProvider {
    private appCheckProvider?;
    private appCheck?;
    private serverAppAppCheckToken?;
    private appName;
    constructor(app: FirebaseApp, appCheckProvider?: Provider<AppCheckInternalComponentName>);
    getToken(forceRefresh?: boolean): Promise<AppCheckTokenResult>;
    addTokenChangeListener(listener: AppCheckTokenListener): void;
    notifyForInvalidToken(): void;
}

declare interface AuthTokenProvider {
    getToken(forceRefresh: boolean): Promise<FirebaseAuthTokenData>;
    addTokenChangeListener(listener: (token: string | null) => void): void;
    removeTokenChangeListener(listener: (token: string | null) => void): void;
    notifyForInvalidToken(): void;
}

/**
 * A cache node only stores complete children. Additionally it holds a flag whether the node can be considered fully
 * initialized in the sense that we know at one point in time this represented a valid state of the world, e.g.
 * initialized with data from the server, or a complete overwrite by the client. The filtered flag also tracks
 * whether a node potentially had children removed due to a filter.
 */
declare class CacheNode {
    private node_;
    private fullyInitialized_;
    private filtered_;
    constructor(node_: Node_2, fullyInitialized_: boolean, filtered_: boolean);
    /**
     * Returns whether this node was fully initialized with either server data or a complete overwrite by the client
     */
    isFullyInitialized(): boolean;
    /**
     * Returns whether this node is potentially missing children due to a filter applied to the node
     */
    isFiltered(): boolean;
    isCompleteForPath(path: Path): boolean;
    isCompleteForChild(key: string): boolean;
    getNode(): Node_2;
}

declare class CancelEvent implements Event_2 {
    eventRegistration: EventRegistration;
    error: Error;
    path: Path;
    constructor(eventRegistration: EventRegistration, error: Error, path: Path);
    getPath(): Path;
    getEventType(): string;
    getEventRunner(): () => void;
    toString(): string;
}

declare interface Change {
    /** @param type - The event type */
    type: ChangeType;
    /** @param snapshotNode - The data */
    snapshotNode: Node_2;
    /** @param childName - The name for this child, if it's a child even */
    childName?: string;
    /** @param oldSnap - Used for intermediate processing of child changed events */
    oldSnap?: Node_2;
    /**  * @param prevName - The name for the previous child, if applicable */
    prevName?: string | null;
}

declare const enum ChangeType {
    /** Event type for a child added */
    CHILD_ADDED = "child_added",
    /** Event type for a child removed */
    CHILD_REMOVED = "child_removed",
    /** Event type for a child changed */
    CHILD_CHANGED = "child_changed",
    /** Event type for a child moved */
    CHILD_MOVED = "child_moved",
    /** Event type for a value change */
    VALUE = "value"
}

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

declare class ChildChangeAccumulator {
    private readonly changeMap;
    trackChildChange(change: Change): void;
    getChanges(): Change[];
}

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
/**
 * @fileoverview Implementation of an immutable SortedMap using a Left-leaning
 * Red-Black Tree, adapted from the implementation in Mugs
 * (http://mads379.github.com/mugs/) by Mads Hartmann Jensen
 * (mads379\@gmail.com).
 *
 * Original paper on Left-leaning Red-Black Trees:
 *   http://www.cs.princeton.edu/~rs/talks/LLRB/LLRB.pdf
 *
 * Invariant 1: No red node has a red child
 * Invariant 2: Every leaf path has the same number of black nodes
 * Invariant 3: Only the left child can be red (left leaning)
 */
declare type Comparator<K> = (key1: K, key2: K) => number;

/**
 * Since updates to filtered nodes might require nodes to be pulled in from "outside" the node, this interface
 * can help to get complete children that can be pulled in.
 * A class implementing this interface takes potentially multiple sources (e.g. user writes, server data from
 * other views etc.) to try it's best to get a complete child that might be useful in pulling into the view.
 *
 * @interface
 */
declare interface CompleteChildSource {
    getCompleteChild(childKey: string): Node_2 | null;
    getChildAfterChild(index: Index, child: NamedNode, reverse: boolean): NamedNode | null;
}

/**
 * This class holds a collection of writes that can be applied to nodes in unison. It abstracts away the logic with
 * dealing with priority writes and multiple nested writes. At any given path there is only allowed to be one write
 * modifying that path. Any write to an existing path or shadowing an existing path will modify that existing write
 * to reflect the write added.
 */
declare class CompoundWrite {
    writeTree_: ImmutableTree<Node_2>;
    constructor(writeTree_: ImmutableTree<Node_2>);
    static empty(): CompoundWrite;
}

/**
 * Modify the provided instance to communicate with the Realtime Database
 * emulator.
 *
 * <p>Note: This method must be called before performing any other operation.
 *
 * @param db - The instance to modify.
 * @param host - The emulator host (ex: localhost)
 * @param port - The emulator port (ex: 8080)
 * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
 */
export declare function connectDatabaseEmulator(db: Database, host: string, port: number, options?: {
    mockUserToken?: EmulatorMockTokenOptions | string;
}): void;

/**
 * Class representing a Firebase Realtime Database.
 */
export declare class Database implements _FirebaseService {
    _repoInternal: Repo;
    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
    readonly app: FirebaseApp;
    /** Represents a `Database` instance. */
    readonly 'type' = "database";
    /** Track if the instance has been used (root or repo accessed) */
    _instanceStarted: boolean;
    /** Backing state for root_ */
    private _rootInternal?;
    /** @hideconstructor */
    constructor(_repoInternal: Repo, 
    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
    app: FirebaseApp);
    get _repo(): Repo;
    get _root(): _ReferenceImpl;
    _delete(): Promise<void>;
    _checkNotDeleted(apiName: string): void;
}

/**
 * A `DatabaseReference` represents a specific location in your Database and can be used
 * for reading or writing data to that Database location.
 *
 * You can reference the root or child location in your Database by calling
 * `ref()` or `ref("child/path")`.
 *
 * Writing is done with the `set()` method and reading can be done with the
 * `on*()` method. See {@link
 * https://firebase.google.com/docs/database/web/read-and-write}
 */
export declare interface DatabaseReference extends Query {
    /**
     * The last part of the `DatabaseReference`'s path.
     *
     * For example, `"ada"` is the key for
     * `https://<DATABASE_NAME>.firebaseio.com/users/ada`.
     *
     * The key of a root `DatabaseReference` is `null`.
     */
    readonly key: string | null;
    /**
     * The parent location of a `DatabaseReference`.
     *
     * The parent of a root `DatabaseReference` is `null`.
     */
    readonly parent: DatabaseReference | null;
    /** The root `DatabaseReference` of the Database. */
    readonly root: DatabaseReference;
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
    readonly _node: Node_2;
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
    constructor(_node: Node_2, 
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
export { EmulatorMockTokenOptions }

/**
 * Logs debugging information to the console.
 *
 * @param enabled - Enables logging if `true`, disables logging if `false`.
 * @param persistent - Remembers the logging state between page refreshes if
 * `true`.
 */
export declare function enableLogging(enabled: boolean, persistent?: boolean): any;

/**
 * Logs debugging information to the console.
 *
 * @param logger - A custom logger function to control how things get logged.
 */
export declare function enableLogging(logger: (message: string) => unknown): any;

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
 * Encapsulates the data needed to raise an event
 * @interface
 */
declare interface Event_2 {
    getPath(): Path;
    getEventType(): string;
    getEventRunner(): () => void;
    toString(): string;
}

/**
 * An EventGenerator is used to convert "raw" changes (Change) as computed by the
 * CacheDiffer into actual events (Event) that can be raised.  See generateEventsForChanges()
 * for details.
 *
 */
declare class EventGenerator {
    query_: QueryContext;
    index_: Index;
    constructor(query_: QueryContext);
}

declare interface EventList {
    events: Event_2[];
    path: Path;
}

/**
 * The event queue serves a few purposes:
 * 1. It ensures we maintain event order in the face of event callbacks doing operations that result in more
 *    events being queued.
 * 2. raiseQueuedEvents() handles being called reentrantly nicely.  That is, if in the course of raising events,
 *    raiseQueuedEvents() is called again, the "inner" call will pick up raising events where the "outer" call
 *    left off, ensuring that the events are still raised synchronously and in order.
 * 3. You can use raiseEventsAtPath and raiseEventsForChangedPath to ensure only relevant previously-queued
 *    events are raised synchronously.
 *
 * NOTE: This can all go away if/when we move to async events.
 *
 */
declare class EventQueue {
    eventLists_: EventList[];
    /**
     * Tracks recursion depth of raiseQueuedEvents_, for debugging purposes.
     */
    recursionDepth_: number;
}

/**
 * An EventRegistration is basically an event type ('value', 'child_added', etc.) and a callback
 * to be notified of that type of event.
 *
 * That said, it can also contain a cancel callback to be notified if the event is canceled.  And
 * currently, this code is organized around the idea that you would register multiple child_ callbacks
 * together, as a single EventRegistration.  Though currently we don't do that.
 */
declare interface EventRegistration {
    /**
     * True if this container has a callback to trigger for this event type
     */
    respondsTo(eventType: string): boolean;
    createEvent(change: Change, query: QueryContext): Event_2;
    /**
     * Given event data, return a function to trigger the user's callback
     */
    getEventRunner(eventData: Event_2): () => void;
    createCancelEvent(error: Error, path: Path): CancelEvent | null;
    matches(other: EventRegistration): boolean;
    /**
     * False basically means this is a "dummy" callback container being used as a sentinel
     * to remove all callback containers of a particular type.  (e.g. if the user does
     * ref.off('value') without specifying a specific callback).
     *
     * (TODO: Rework this, since it's hacky)
     *
     */
    hasAnyCallback(): boolean;
}

/**
 * One of the following strings: "value", "child_added", "child_changed",
 * "child_removed", or "child_moved."
 */
export declare type EventType = 'value' | 'child_added' | 'child_changed' | 'child_moved' | 'child_removed';

/**
 * Force the use of longPolling instead of websockets. This will be ignored if websocket protocol is used in databaseURL.
 */
export declare function forceLongPolling(): void;

/**
 * Force the use of websockets instead of longPolling.
 */
export declare function forceWebSockets(): void;

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
 * Returns the instance of the Realtime Database SDK that is associated with the provided
 * {@link @firebase/app#FirebaseApp}. Initializes a new instance with default settings if
 * no instance exists or if the existing instance uses a custom database URL.
 *
 * @param app - The {@link @firebase/app#FirebaseApp} instance that the returned Realtime
 * Database instance is associated with.
 * @param url - The URL of the Realtime Database instance to connect to. If not
 * provided, the SDK connects to the default instance of the Firebase App.
 * @returns The `Database` instance of the provided app.
 */
export declare function getDatabase(app?: FirebaseApp, url?: string): Database;

/**
 * Disconnects from the server (all Database operations will be completed
 * offline).
 *
 * The client automatically maintains a persistent connection to the Database
 * server, which will remain active indefinitely and reconnect when
 * disconnected. However, the `goOffline()` and `goOnline()` methods may be used
 * to control the client connection in cases where a persistent connection is
 * undesirable.
 *
 * While offline, the client will no longer receive data updates from the
 * Database. However, all Database operations performed locally will continue to
 * immediately fire events, allowing your application to continue behaving
 * normally. Additionally, each operation performed locally will automatically
 * be queued and retried upon reconnection to the Database server.
 *
 * To reconnect to the Database and begin receiving remote events, see
 * `goOnline()`.
 *
 * @param db - The instance to disconnect.
 */
export declare function goOffline(db: Database): void;

/**
 * Reconnects to the server and synchronizes the offline Database state
 * with the server state.
 *
 * This method should be used after disabling the active connection with
 * `goOffline()`. Once reconnected, the client will transmit the proper data
 * and fire the appropriate events so that your client "catches up"
 * automatically.
 *
 * @param db - The instance to reconnect.
 */
export declare function goOnline(db: Database): void;

/**
 * A tree with immutable elements.
 */
declare class ImmutableTree<T> {
    readonly value: T | null;
    readonly children: SortedMap<string, ImmutableTree<T>>;
    static fromObject<T>(obj: {
        [k: string]: T;
    }): ImmutableTree<T>;
    constructor(value: T | null, children?: SortedMap<string, ImmutableTree<T>>);
    /**
     * True if the value is empty and there are no children
     */
    isEmpty(): boolean;
    /**
     * Given a path and predicate, return the first node and the path to that node
     * where the predicate returns true.
     *
     * TODO Do a perf test -- If we're creating a bunch of `{path: value:}`
     * objects on the way back out, it may be better to pass down a pathSoFar obj.
     *
     * @param relativePath - The remainder of the path
     * @param predicate - The predicate to satisfy to return a node
     */
    findRootMostMatchingPathAndValue(relativePath: Path, predicate: (a: T) => boolean): {
        path: Path;
        value: T;
    } | null;
    /**
     * Find, if it exists, the shortest subpath of the given path that points a defined
     * value in the tree
     */
    findRootMostValueAndPath(relativePath: Path): {
        path: Path;
        value: T;
    } | null;
    /**
     * @returns The subtree at the given path
     */
    subtree(relativePath: Path): ImmutableTree<T>;
    /**
     * Sets a value at the specified path.
     *
     * @param relativePath - Path to set value at.
     * @param toSet - Value to set.
     * @returns Resulting tree.
     */
    set(relativePath: Path, toSet: T | null): ImmutableTree<T>;
    /**
     * Removes the value at the specified path.
     *
     * @param relativePath - Path to value to remove.
     * @returns Resulting tree.
     */
    remove(relativePath: Path): ImmutableTree<T>;
    /**
     * Gets a value from the tree.
     *
     * @param relativePath - Path to get value for.
     * @returns Value at path, or null.
     */
    get(relativePath: Path): T | null;
    /**
     * Replace the subtree at the specified path with the given new tree.
     *
     * @param relativePath - Path to replace subtree for.
     * @param newTree - New tree.
     * @returns Resulting tree.
     */
    setTree(relativePath: Path, newTree: ImmutableTree<T>): ImmutableTree<T>;
    /**
     * Performs a depth first fold on this tree. Transforms a tree into a single
     * value, given a function that operates on the path to a node, an optional
     * current value, and a map of child names to folded subtrees
     */
    fold<V>(fn: (path: Path, value: T, children: {
        [k: string]: V;
    }) => V): V;
    /**
     * Recursive helper for public-facing fold() method
     */
    private fold_;
    /**
     * Find the first matching value on the given path. Return the result of applying f to it.
     */
    findOnPath<V>(path: Path, f: (path: Path, value: T) => V | null): V | null;
    private findOnPath_;
    foreachOnPath(path: Path, f: (path: Path, value: T) => void): ImmutableTree<T>;
    private foreachOnPath_;
    /**
     * Calls the given function for each node in the tree that has a value.
     *
     * @param f - A function to be called with the path from the root of the tree to
     * a node, and the value at that node. Called in depth-first order.
     */
    foreach(f: (path: Path, value: T) => void): void;
    private foreach_;
    foreachChild(f: (name: string, value: T) => void): void;
}

/**
 * Returns a placeholder value that can be used to atomically increment the
 * current database value by the provided delta.
 *
 * @param delta - the amount to modify the current value atomically.
 * @returns A placeholder value for modifying data atomically server-side.
 */
export declare function increment(delta: number): object;

declare abstract class Index {
    abstract compare(a: NamedNode, b: NamedNode): number;
    abstract isDefinedOn(node: Node_2): boolean;
    /**
     * @returns A standalone comparison function for
     * this index
     */
    getCompare(): Comparator<NamedNode>;
    /**
     * Given a before and after value for a node, determine if the indexed value has changed. Even if they are different,
     * it's possible that the changes are isolated to parts of the snapshot that are not indexed.
     *
     *
     * @returns True if the portion of the snapshot being indexed changed between oldNode and newNode
     */
    indexedValueChanged(oldNode: Node_2, newNode: Node_2): boolean;
    /**
     * @returns a node wrapper that will sort equal to or less than
     * any other node wrapper, using this index
     */
    minPost(): NamedNode;
    /**
     * @returns a node wrapper that will sort greater than or equal to
     * any other node wrapper, using this index
     */
    abstract maxPost(): NamedNode;
    abstract makePost(indexValue: unknown, name: string): NamedNode;
    /**
     * @returns String representation for inclusion in a query spec
     */
    abstract toString(): string;
}

/**
 * Used by console to create a database based on the app,
 * passed database URL and a custom auth implementation.
 * @internal
 * @param app - A valid FirebaseApp-like object
 * @param url - A valid Firebase databaseURL
 * @param version - custom version e.g. firebase-admin version
 * @param customAppCheckImpl - custom app check implementation
 * @param customAuthImpl - custom auth implementation
 */
export declare function _initStandalone({ app, url, version, customAuthImpl, customAppCheckImpl, nodeAdmin }: {
    app: FirebaseApp_2;
    url: string;
    version: string;
    customAuthImpl: FirebaseAuthInternal;
    customAppCheckImpl?: FirebaseAppCheckInternal;
    nodeAdmin?: boolean;
}): Database;

/**
 * Represents a child snapshot of a `Reference` that is being iterated over. The key will never be undefined.
 */
export declare interface IteratedDataSnapshot extends DataSnapshot {
    key: string;
}

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

/** An options objects that can be used to customize a listener. */
export declare interface ListenOptions {
    /** Whether to remove the listener after its first invocation. */
    readonly onlyOnce?: boolean;
}

declare interface ListenProvider {
    startListening(query: QueryContext, tag: number | null, hashFn: () => string, onComplete: (a: string, b?: unknown) => Event_2[]): Event_2[];
    stopListening(a: QueryContext, b: number | null): void;
}

/**
 * Represents an empty node (a leaf node in the Red-Black Tree).
 */
declare class LLRBEmptyNode<K, V> {
    key: K;
    value: V;
    left: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    right: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    color: boolean;
    /**
     * Returns a copy of the current node.
     *
     * @returns The node copy.
     */
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): LLRBEmptyNode<K, V>;
    /**
     * Returns a copy of the tree, with the specified key/value added.
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @param comparator - Comparator.
     * @returns New tree, with item added.
     */
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    /**
     * Returns a copy of the tree, with the specified key removed.
     *
     * @param key - The key to remove.
     * @param comparator - Comparator.
     * @returns New tree, with item removed.
     */
    remove(key: K, comparator: Comparator<K>): LLRBEmptyNode<K, V>;
    /**
     * @returns The total number of nodes in the tree.
     */
    count(): number;
    /**
     * @returns True if the tree is empty.
     */
    isEmpty(): boolean;
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    minKey(): null;
    maxKey(): null;
    check_(): number;
    /**
     * @returns Whether this node is red.
     */
    isRed_(): boolean;
}

/**
 * Represents a node in a Left-leaning Red-Black tree.
 */
declare class LLRBNode<K, V> {
    key: K;
    value: V;
    color: boolean;
    left: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    right: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    /**
     * @param key - Key associated with this node.
     * @param value - Value associated with this node.
     * @param color - Whether this node is red.
     * @param left - Left child.
     * @param right - Right child.
     */
    constructor(key: K, value: V, color: boolean | null, left?: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right?: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null);
    static RED: boolean;
    static BLACK: boolean;
    /**
     * Returns a copy of the current node, optionally replacing pieces of it.
     *
     * @param key - New key for the node, or null.
     * @param value - New value for the node, or null.
     * @param color - New color for the node, or null.
     * @param left - New left child for the node, or null.
     * @param right - New right child for the node, or null.
     * @returns The node copy.
     */
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): LLRBNode<K, V>;
    /**
     * @returns The total number of nodes in the tree.
     */
    count(): number;
    /**
     * @returns True if the tree is empty.
     */
    isEmpty(): boolean;
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     *   node.  If it returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    /**
     * @returns The minimum node in the tree.
     */
    private min_;
    /**
     * @returns The maximum key in the tree.
     */
    minKey(): K;
    /**
     * @returns The maximum key in the tree.
     */
    maxKey(): K;
    /**
     * @param key - Key to insert.
     * @param value - Value to insert.
     * @param comparator - Comparator.
     * @returns New tree, with the key/value added.
     */
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    /**
     * @returns New tree, with the minimum key removed.
     */
    private removeMin_;
    /**
     * @param key - The key of the item to remove.
     * @param comparator - Comparator.
     * @returns New tree, with the specified item removed.
     */
    remove(key: K, comparator: Comparator<K>): LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    /**
     * @returns Whether this is a RED node.
     */
    isRed_(): boolean;
    /**
     * @returns New tree after performing any needed rotations.
     */
    private fixUp_;
    /**
     * @returns New tree, after moveRedLeft.
     */
    private moveRedLeft_;
    /**
     * @returns New tree, after moveRedRight.
     */
    private moveRedRight_;
    /**
     * @returns New tree, after rotateLeft.
     */
    private rotateLeft_;
    /**
     * @returns New tree, after rotateRight.
     */
    private rotateRight_;
    /**
     * @returns Newt ree, after colorFlip.
     */
    private colorFlip_;
    /**
     * For testing.
     *
     * @returns True if all is well.
     */
    private checkMaxDepth_;
    check_(): number;
}

declare class NamedNode {
    name: string;
    node: Node_2;
    constructor(name: string, node: Node_2);
    static Wrap(name: string, node: Node_2): NamedNode;
}

/**
 * Node is an interface defining the common functionality for nodes in
 * a DataSnapshot.
 *
 * @interface
 */
declare interface Node_2 {
    /**
     * Whether this node is a leaf node.
     * @returns Whether this is a leaf node.
     */
    isLeafNode(): boolean;
    /**
     * Gets the priority of the node.
     * @returns The priority of the node.
     */
    getPriority(): Node_2;
    /**
     * Returns a duplicate node with the new priority.
     * @param newPriorityNode - New priority to set for the node.
     * @returns Node with new priority.
     */
    updatePriority(newPriorityNode: Node_2): Node_2;
    /**
     * Returns the specified immediate child, or null if it doesn't exist.
     * @param childName - The name of the child to retrieve.
     * @returns The retrieved child, or an empty node.
     */
    getImmediateChild(childName: string): Node_2;
    /**
     * Returns a child by path, or null if it doesn't exist.
     * @param path - The path of the child to retrieve.
     * @returns The retrieved child or an empty node.
     */
    getChild(path: Path): Node_2;
    /**
     * Returns the name of the child immediately prior to the specified childNode, or null.
     * @param childName - The name of the child to find the predecessor of.
     * @param childNode - The node to find the predecessor of.
     * @param index - The index to use to determine the predecessor
     * @returns The name of the predecessor child, or null if childNode is the first child.
     */
    getPredecessorChildName(childName: string, childNode: Node_2, index: Index): string | null;
    /**
     * Returns a duplicate node, with the specified immediate child updated.
     * Any value in the node will be removed.
     * @param childName - The name of the child to update.
     * @param newChildNode - The new child node
     * @returns The updated node.
     */
    updateImmediateChild(childName: string, newChildNode: Node_2): Node_2;
    /**
     * Returns a duplicate node, with the specified child updated.  Any value will
     * be removed.
     * @param path - The path of the child to update.
     * @param newChildNode - The new child node, which may be an empty node
     * @returns The updated node.
     */
    updateChild(path: Path, newChildNode: Node_2): Node_2;
    /**
     * True if the immediate child specified exists
     */
    hasChild(childName: string): boolean;
    /**
     * @returns True if this node has no value or children.
     */
    isEmpty(): boolean;
    /**
     * @returns The number of children of this node.
     */
    numChildren(): number;
    /**
     * Calls action for each child.
     * @param action - Action to be called for
     * each child.  It's passed the child name and the child node.
     * @returns The first truthy value return by action, or the last falsey one
     */
    forEachChild(index: Index, action: (a: string, b: Node_2) => void): unknown;
    /**
     * @param exportFormat - True for export format (also wire protocol format).
     * @returns Value of this node as JSON.
     */
    val(exportFormat?: boolean): unknown;
    /**
     * @returns hash representing the node contents.
     */
    hash(): string;
    /**
     * @param other - Another node
     * @returns -1 for less than, 0 for equal, 1 for greater than other
     */
    compareTo(other: Node_2): number;
    /**
     * @returns Whether or not this snapshot equals other
     */
    equals(other: Node_2): boolean;
    /**
     * @returns This node, with the specified index now available
     */
    withIndex(indexDefinition: Index): Node_2;
    isIndexed(indexDefinition: Index): boolean;
}

/**
 * NodeFilter is used to update nodes and complete children of nodes while applying queries on the fly and keeping
 * track of any child changes. This class does not track value changes as value changes depend on more
 * than just the node itself. Different kind of queries require different kind of implementations of this interface.
 * @interface
 */
declare interface NodeFilter_2 {
    /**
     * Update a single complete child in the snap. If the child equals the old child in the snap, this is a no-op.
     * The method expects an indexed snap.
     */
    updateChild(snap: Node_2, key: string, newChild: Node_2, affectedPath: Path, source: CompleteChildSource, optChangeAccumulator: ChildChangeAccumulator | null): Node_2;
    /**
     * Update a node in full and output any resulting change from this complete update.
     */
    updateFullNode(oldSnap: Node_2, newSnap: Node_2, optChangeAccumulator: ChildChangeAccumulator | null): Node_2;
    /**
     * Update the priority of the root node
     */
    updatePriority(oldSnap: Node_2, newPriority: Node_2): Node_2;
    /**
     * Returns true if children might be filtered due to query criteria
     */
    filtersNodes(): boolean;
    /**
     * Returns the index filter that this filter uses to get a NodeFilter that doesn't filter any children.
     */
    getIndexedFilter(): NodeFilter_2;
    /**
     * Returns the index that this filter uses
     */
    getIndex(): Index;
}

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

/**
 * The `onDisconnect` class allows you to write or clear data when your client
 * disconnects from the Database server. These updates occur whether your
 * client disconnects cleanly or not, so you can rely on them to clean up data
 * even if a connection is dropped or a client crashes.
 *
 * The `onDisconnect` class is most commonly used to manage presence in
 * applications where it is useful to detect how many clients are connected and
 * when other clients disconnect. See
 * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
 * for more information.
 *
 * To avoid problems when a connection is dropped before the requests can be
 * transferred to the Database server, these functions should be called before
 * writing any data.
 *
 * Note that `onDisconnect` operations are only triggered once. If you want an
 * operation to occur each time a disconnect occurs, you'll need to re-establish
 * the `onDisconnect` operations each time you reconnect.
 */
export declare class OnDisconnect {
    private _repo;
    private _path;
    /** @hideconstructor */
    constructor(_repo: Repo, _path: Path);
    /**
     * Cancels all previously queued `onDisconnect()` set or update events for this
     * location and all children.
     *
     * If a write has been queued for this location via a `set()` or `update()` at a
     * parent location, the write at this location will be canceled, though writes
     * to sibling locations will still occur.
     *
     * @returns Resolves when synchronization to the server is complete.
     */
    cancel(): Promise<void>;
    /**
     * Ensures the data at this location is deleted when the client is disconnected
     * (due to closing the browser, navigating to a new page, or network issues).
     *
     * @returns Resolves when synchronization to the server is complete.
     */
    remove(): Promise<void>;
    /**
     * Ensures the data at this location is set to the specified value when the
     * client is disconnected (due to closing the browser, navigating to a new page,
     * or network issues).
     *
     * `set()` is especially useful for implementing "presence" systems, where a
     * value should be changed or cleared when a user disconnects so that they
     * appear "offline" to other users. See
     * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
     * for more information.
     *
     * Note that `onDisconnect` operations are only triggered once. If you want an
     * operation to occur each time a disconnect occurs, you'll need to re-establish
     * the `onDisconnect` operations each time.
     *
     * @param value - The value to be written to this location on disconnect (can
     * be an object, array, string, number, boolean, or null).
     * @returns Resolves when synchronization to the Database is complete.
     */
    set(value: unknown): Promise<void>;
    /**
     * Ensures the data at this location is set to the specified value and priority
     * when the client is disconnected (due to closing the browser, navigating to a
     * new page, or network issues).
     *
     * @param value - The value to be written to this location on disconnect (can
     * be an object, array, string, number, boolean, or null).
     * @param priority - The priority to be written (string, number, or null).
     * @returns Resolves when synchronization to the Database is complete.
     */
    setWithPriority(value: unknown, priority: number | string | null): Promise<void>;
    /**
     * Writes multiple values at this location when the client is disconnected (due
     * to closing the browser, navigating to a new page, or network issues).
     *
     * The `values` argument contains multiple property-value pairs that will be
     * written to the Database together. Each child property can either be a simple
     * property (for example, "name") or a relative path (for example, "name/first")
     * from the current location to the data to update.
     *
     * As opposed to the `set()` method, `update()` can be use to selectively update
     * only the referenced properties at the current location (instead of replacing
     * all the child properties at the current location).
     *
     * @param values - Object containing multiple values.
     * @returns Resolves when synchronization to the Database is complete.
     */
    update(values: object): Promise<void>;
}

/**
 * Returns an `OnDisconnect` object - see
 * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
 * for more information on how to use it.
 *
 * @param ref - The reference to add OnDisconnect triggers for.
 */
export declare function onDisconnect(ref: DatabaseReference): OnDisconnect;

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
/**
 * An immutable object representing a parsed path.  It's immutable so that you
 * can pass them around to other functions without worrying about them changing
 * it.
 */
declare class Path {
    pieces_: string[];
    pieceNum_: number;
    /**
     * @param pathOrString - Path string to parse, or another path, or the raw
     * tokens array
     */
    constructor(pathOrString: string | string[], pieceNum?: number);
    toString(): string;
}

/**
 * Firebase connection.  Abstracts wire protocol and handles reconnecting.
 *
 * NOTE: All JSON objects sent to the realtime connection must have property names enclosed
 * in quotes to make sure the closure compiler does not minify them.
 */
declare class PersistentConnection extends ServerActions {
    private repoInfo_;
    private applicationId_;
    private onDataUpdate_;
    private onConnectStatus_;
    private onServerInfoUpdate_;
    private authTokenProvider_;
    private appCheckTokenProvider_;
    private authOverride_?;
    id: number;
    private log_;
    private interruptReasons_;
    private readonly listens;
    private outstandingPuts_;
    private outstandingGets_;
    private outstandingPutCount_;
    private outstandingGetCount_;
    private onDisconnectRequestQueue_;
    private connected_;
    private reconnectDelay_;
    private maxReconnectDelay_;
    private securityDebugCallback_;
    lastSessionId: string | null;
    private establishConnectionTimer_;
    private visible_;
    private requestCBHash_;
    private requestNumber_;
    private realtime_;
    private authToken_;
    private appCheckToken_;
    private forceTokenRefresh_;
    private invalidAuthTokenCount_;
    private invalidAppCheckTokenCount_;
    private firstConnection_;
    private lastConnectionAttemptTime_;
    private lastConnectionEstablishedTime_;
    private static nextPersistentConnectionId_;
    /**
     * Counter for number of connections created. Mainly used for tagging in the logs
     */
    private static nextConnectionId_;
    /**
     * @param repoInfo_ - Data about the namespace we are connecting to
     * @param applicationId_ - The Firebase App ID for this project
     * @param onDataUpdate_ - A callback for new data from the server
     */
    constructor(repoInfo_: RepoInfo, applicationId_: string, onDataUpdate_: (a: string, b: unknown, c: boolean, d: number | null) => void, onConnectStatus_: (a: boolean) => void, onServerInfoUpdate_: (a: unknown) => void, authTokenProvider_: AuthTokenProvider, appCheckTokenProvider_: AppCheckTokenProvider, authOverride_?: object | null);
    protected sendRequest(action: string, body: unknown, onResponse?: (a: unknown) => void): void;
    get(query: QueryContext): Promise<string>;
    listen(query: QueryContext, currentHashFn: () => string, tag: number | null, onComplete: (a: string, b: unknown) => void): void;
    private sendGet_;
    private sendListen_;
    private static warnOnListenWarnings_;
    refreshAuthToken(token: string): void;
    private reduceReconnectDelayIfAdminCredential_;
    refreshAppCheckToken(token: string | null): void;
    /**
     * Attempts to authenticate with the given credentials. If the authentication attempt fails, it's triggered like
     * a auth revoked (the connection is closed).
     */
    tryAuth(): void;
    /**
     * Attempts to authenticate with the given token. If the authentication
     * attempt fails, it's triggered like the token was revoked (the connection is
     * closed).
     */
    tryAppCheck(): void;
    /**
     * @inheritDoc
     */
    unlisten(query: QueryContext, tag: number | null): void;
    private sendUnlisten_;
    onDisconnectPut(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void): void;
    onDisconnectMerge(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void): void;
    onDisconnectCancel(pathString: string, onComplete?: (a: string, b: string) => void): void;
    private sendOnDisconnect_;
    put(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void, hash?: string): void;
    merge(pathString: string, data: unknown, onComplete: (a: string, b: string | null) => void, hash?: string): void;
    putInternal(action: string, pathString: string, data: unknown, onComplete: (a: string, b: string | null) => void, hash?: string): void;
    private sendPut_;
    reportStats(stats: {
        [k: string]: unknown;
    }): void;
    private onDataMessage_;
    private onDataPush_;
    private onReady_;
    private scheduleConnect_;
    private initConnection_;
    private onVisible_;
    private onOnline_;
    private onRealtimeDisconnect_;
    private establishConnection_;
    interrupt(reason: string): void;
    resume(reason: string): void;
    private handleTimestamp_;
    private cancelSentTransactions_;
    private onListenRevoked_;
    private removeListen_;
    private onAuthRevoked_;
    private onAppCheckRevoked_;
    private onSecurityDebugPacket_;
    private restoreState_;
    /**
     * Sends client stats for first connection
     */
    private sendConnectStats_;
    private shouldReconnect_;
}

declare class PriorityIndex extends Index {
    compare(a: NamedNode, b: NamedNode): number;
    isDefinedOn(node: Node_2): boolean;
    indexedValueChanged(oldNode: Node_2, newNode: Node_2): boolean;
    minPost(): NamedNode;
    maxPost(): NamedNode;
    makePost(indexValue: unknown, name: string): NamedNode;
    /**
     * @returns String representation for inclusion in a query spec
     */
    toString(): string;
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
 * @license
 * Copyright 2021 Google LLC
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
/**
 * A `Query` sorts and filters the data at a Database location so only a subset
 * of the child data is included. This can be used to order a collection of
 * data by some attribute (for example, height of dinosaurs) as well as to
 * restrict a large list of items (for example, chat messages) down to a number
 * suitable for synchronizing to the client. Queries are created by chaining
 * together one or more of the filter methods defined here.
 *
 * Just as with a `DatabaseReference`, you can receive data from a `Query` by using the
 * `on*()` methods. You will only receive events and `DataSnapshot`s for the
 * subset of the data that matches your query.
 *
 * See {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data}
 * for more information.
 */
export declare interface Query extends QueryContext {
    /** The `DatabaseReference` for the `Query`'s location. */
    readonly ref: DatabaseReference;
    /**
     * Returns whether or not the current and provided queries represent the same
     * location, have the same query parameters, and are from the same instance of
     * `FirebaseApp`.
     *
     * Two `DatabaseReference` objects are equivalent if they represent the same location
     * and are from the same instance of `FirebaseApp`.
     *
     * Two `Query` objects are equivalent if they represent the same location,
     * have the same query parameters, and are from the same instance of
     * `FirebaseApp`. Equivalent queries share the same sort order, limits, and
     * starting and ending points.
     *
     * @param other - The query to compare against.
     * @returns Whether or not the current and provided queries are equivalent.
     */
    isEqual(other: Query | null): boolean;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): string;
    /**
     * Gets the absolute URL for this location.
     *
     * The `toString()` method returns a URL that is ready to be put into a
     * browser, curl command, or a `refFromURL()` call. Since all of those expect
     * the URL to be url-encoded, `toString()` returns an encoded URL.
     *
     * Append '.json' to the returned URL when typed into a browser to download
     * JSON-formatted data. If the location is secured (that is, not publicly
     * readable), you will get a permission-denied error.
     *
     * @returns The absolute URL for this location.
     */
    toString(): string;
}

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
    abstract _apply<T>(query: _QueryImpl): _QueryImpl;
}

/** Describes the different query constraints available in this SDK. */
export declare type QueryConstraintType = 'endAt' | 'endBefore' | 'startAt' | 'startAfter' | 'limitToFirst' | 'limitToLast' | 'orderByChild' | 'orderByKey' | 'orderByPriority' | 'orderByValue' | 'equalTo';

declare interface QueryContext {
    readonly _queryIdentifier: string;
    readonly _queryObject: object;
    readonly _repo: Repo;
    readonly _path: Path;
    readonly _queryParams: _QueryParams;
}

/**
 * @internal
 */
export declare class _QueryImpl implements Query, QueryContext {
    readonly _repo: Repo;
    readonly _path: Path;
    readonly _queryParams: _QueryParams;
    readonly _orderByCalled: boolean;
    /**
     * @hideconstructor
     */
    constructor(_repo: Repo, _path: Path, _queryParams: _QueryParams, _orderByCalled: boolean);
    get key(): string | null;
    get ref(): DatabaseReference;
    get _queryIdentifier(): string;
    /**
     * An object representation of the query parameters used by this Query.
     */
    get _queryObject(): object;
    isEqual(other: _QueryImpl | null): boolean;
    toJSON(): string;
    toString(): string;
}

/**
 * This class is an immutable-from-the-public-api struct containing a set of query parameters defining a
 * range to be returned for a particular location. It is assumed that validation of parameters is done at the
 * user-facing API level, so it is not done here.
 *
 * @internal
 */
export declare class _QueryParams {
    limitSet_: boolean;
    startSet_: boolean;
    startNameSet_: boolean;
    startAfterSet_: boolean;
    endSet_: boolean;
    endNameSet_: boolean;
    endBeforeSet_: boolean;
    limit_: number;
    viewFrom_: string;
    indexStartValue_: unknown | null;
    indexStartName_: string;
    indexEndValue_: unknown | null;
    indexEndName_: string;
    index_: PriorityIndex;
    hasStart(): boolean;
    /**
     * @returns True if it would return from left.
     */
    isViewFromLeft(): boolean;
    /**
     * Only valid to call if hasStart() returns true
     */
    getIndexStartValue(): unknown;
    /**
     * Only valid to call if hasStart() returns true.
     * Returns the starting key name for the range defined by these query parameters
     */
    getIndexStartName(): string;
    hasEnd(): boolean;
    /**
     * Only valid to call if hasEnd() returns true.
     */
    getIndexEndValue(): unknown;
    /**
     * Only valid to call if hasEnd() returns true.
     * Returns the end key name for the range defined by these query parameters
     */
    getIndexEndName(): string;
    hasLimit(): boolean;
    /**
     * @returns True if a limit has been set and it has been explicitly anchored
     */
    hasAnchoredLimit(): boolean;
    /**
     * Only valid to call if hasLimit() returns true
     */
    getLimit(): number;
    getIndex(): Index;
    loadsAllData(): boolean;
    isDefault(): boolean;
    copy(): _QueryParams;
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
 * @internal
 */
export declare class _ReferenceImpl extends _QueryImpl implements DatabaseReference {
    /** @hideconstructor */
    constructor(repo: Repo, path: Path);
    get parent(): _ReferenceImpl | null;
    get root(): _ReferenceImpl;
}

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
 * A connection to a single data repository.
 */
declare class Repo {
    repoInfo_: RepoInfo;
    forceRestClient_: boolean;
    authTokenProvider_: AuthTokenProvider;
    appCheckProvider_: AppCheckTokenProvider;
    /** Key for uniquely identifying this repo, used in RepoManager */
    readonly key: string;
    dataUpdateCount: number;
    infoSyncTree_: SyncTree;
    serverSyncTree_: SyncTree;
    stats_: StatsCollection;
    statsListener_: StatsListener | null;
    eventQueue_: EventQueue;
    nextWriteId_: number;
    server_: ServerActions;
    statsReporter_: StatsReporter;
    infoData_: SnapshotHolder;
    interceptServerDataCallback_: ((a: string, b: unknown) => void) | null;
    /** A list of data pieces and paths to be set when this client disconnects. */
    onDisconnect_: SparseSnapshotTree;
    /** Stores queues of outstanding transactions for Firebase locations. */
    transactionQueueTree_: Tree<Transaction[]>;
    persistentConnection_: PersistentConnection | null;
    constructor(repoInfo_: RepoInfo, forceRestClient_: boolean, authTokenProvider_: AuthTokenProvider, appCheckProvider_: AppCheckTokenProvider);
    /**
     * @returns The URL corresponding to the root of this Firebase.
     */
    toString(): string;
}

/**
 * A class that holds metadata about a Repo object
 */
declare class RepoInfo {
    readonly secure: boolean;
    readonly namespace: string;
    readonly webSocketOnly: boolean;
    readonly nodeAdmin: boolean;
    readonly persistenceKey: string;
    readonly includeNamespaceInQueryParams: boolean;
    readonly isUsingEmulator: boolean;
    readonly emulatorOptions: RepoInfoEmulatorOptions | null;
    private _host;
    private _domain;
    internalHost: string;
    /**
     * @param host - Hostname portion of the url for the repo
     * @param secure - Whether or not this repo is accessed over ssl
     * @param namespace - The namespace represented by the repo
     * @param webSocketOnly - Whether to prefer websockets over all other transports (used by Nest).
     * @param nodeAdmin - Whether this instance uses Admin SDK credentials
     * @param persistenceKey - Override the default session persistence storage key
     */
    constructor(host: string, secure: boolean, namespace: string, webSocketOnly: boolean, nodeAdmin?: boolean, persistenceKey?: string, includeNamespaceInQueryParams?: boolean, isUsingEmulator?: boolean, emulatorOptions?: RepoInfoEmulatorOptions | null);
    isCacheableHost(): boolean;
    isCustomHost(): boolean;
    get host(): string;
    set host(newHost: string);
    toString(): string;
    toURLString(): string;
}

declare interface RepoInfoEmulatorOptions {
    mockUserToken?: string | EmulatorMockTokenOptions;
}

/**
 * This function should only ever be called to CREATE a new database instance.
 * @internal
 */
export declare function _repoManagerDatabaseFromApp(app: FirebaseApp, authProvider: Provider<FirebaseAuthInternalName>, appCheckProvider?: Provider<AppCheckInternalComponentName>, url?: string, nodeAdmin?: boolean): Database;

/**
 * Atomically modifies the data at this location.
 *
 * Atomically modify the data at this location. Unlike a normal `set()`, which
 * just overwrites the data regardless of its previous value, `runTransaction()` is
 * used to modify the existing value to a new value, ensuring there are no
 * conflicts with other clients writing to the same location at the same time.
 *
 * To accomplish this, you pass `runTransaction()` an update function which is
 * used to transform the current value into a new value. If another client
 * writes to the location before your new value is successfully written, your
 * update function will be called again with the new current value, and the
 * write will be retried. This will happen repeatedly until your write succeeds
 * without conflict or you abort the transaction by not returning a value from
 * your update function.
 *
 * Note: Modifying data with `set()` will cancel any pending transactions at
 * that location, so extreme care should be taken if mixing `set()` and
 * `runTransaction()` to update the same data.
 *
 * Note: When using transactions with Security and Firebase Rules in place, be
 * aware that a client needs `.read` access in addition to `.write` access in
 * order to perform a transaction. This is because the client-side nature of
 * transactions requires the client to read the data in order to transactionally
 * update it.
 *
 * @param ref - The location to atomically modify.
 * @param transactionUpdate - A developer-supplied function which will be passed
 * the current data stored at this location (as a JavaScript object). The
 * function should return the new value it would like written (as a JavaScript
 * object). If `undefined` is returned (i.e. you return with no arguments) the
 * transaction will be aborted and the data at this location will not be
 * modified.
 * @param options - An options object to configure transactions.
 * @returns A `Promise` that can optionally be used instead of the `onComplete`
 * callback to handle success and failure.
 */
export declare function runTransaction(ref: DatabaseReference, transactionUpdate: (currentData: any) => unknown, options?: TransactionOptions): Promise<TransactionResult>;

/**
 * Interface defining the set of actions that can be performed against the Firebase server
 * (basically corresponds to our wire protocol).
 *
 * @interface
 */
declare abstract class ServerActions {
    abstract listen(query: QueryContext, currentHashFn: () => string, tag: number | null, onComplete: (a: string, b: unknown) => void): void;
    /**
     * Remove a listen.
     */
    abstract unlisten(query: QueryContext, tag: number | null): void;
    /**
     * Get the server value satisfying this query.
     */
    abstract get(query: QueryContext): Promise<string>;
    put(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void, hash?: string): void;
    merge(pathString: string, data: unknown, onComplete: (a: string, b: string | null) => void, hash?: string): void;
    /**
     * Refreshes the auth token for the current connection.
     * @param token - The authentication token
     */
    refreshAuthToken(token: string): void;
    /**
     * Refreshes the app check token for the current connection.
     * @param token The app check token
     */
    refreshAppCheckToken(token: string): void;
    onDisconnectPut(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void): void;
    onDisconnectMerge(pathString: string, data: unknown, onComplete?: (a: string, b: string) => void): void;
    onDisconnectCancel(pathString: string, onComplete?: (a: string, b: string) => void): void;
    reportStats(stats: {
        [k: string]: unknown;
    }): void;
}

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
/**
 * Returns a placeholder value for auto-populating the current timestamp (time
 * since the Unix epoch, in milliseconds) as determined by the Firebase
 * servers.
 */
export declare function serverTimestamp(): object;

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
 * SDK_VERSION should be set before any database instance is created
 * @internal
 */
export declare function _setSDKVersion(version: string): void;

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
 * Mutable object which basically just stores a reference to the "latest" immutable snapshot.
 */
declare class SnapshotHolder {
    private rootNode_;
    getNode(path: Path): Node_2;
    updateSnapshot(path: Path, newSnapshotNode: Node_2): void;
}

/**
 * An immutable sorted map implementation, based on a Left-leaning Red-Black
 * tree.
 */
declare class SortedMap<K, V> {
    private comparator_;
    private root_;
    /**
     * Always use the same empty node, to reduce memory.
     */
    static EMPTY_NODE: LLRBEmptyNode<unknown, unknown>;
    /**
     * @param comparator_ - Key comparator.
     * @param root_ - Optional root node for the map.
     */
    constructor(comparator_: Comparator<K>, root_?: LLRBNode<K, V> | LLRBEmptyNode<K, V>);
    /**
     * Returns a copy of the map, with the specified key/value added or replaced.
     * (TODO: We should perhaps rename this method to 'put')
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @returns New map, with item added.
     */
    insert(key: K, value: V): SortedMap<K, V>;
    /**
     * Returns a copy of the map, with the specified key removed.
     *
     * @param key - The key to remove.
     * @returns New map, with item removed.
     */
    remove(key: K): SortedMap<K, V>;
    /**
     * Returns the value of the node with the given key, or null.
     *
     * @param key - The key to look up.
     * @returns The value of the node with the given key, or null if the
     * key doesn't exist.
     */
    get(key: K): V | null;
    /**
     * Returns the key of the item *before* the specified key, or null if key is the first item.
     * @param key - The key to find the predecessor of
     * @returns The predecessor key.
     */
    getPredecessorKey(key: K): K | null;
    /**
     * @returns True if the map is empty.
     */
    isEmpty(): boolean;
    /**
     * @returns The total number of nodes in the map.
     */
    count(): number;
    /**
     * @returns The minimum key in the map.
     */
    minKey(): K | null;
    /**
     * @returns The maximum key in the map.
     */
    maxKey(): K | null;
    /**
     * Traverses the map in key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the map in reverse key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns True if the traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    /**
     * Returns an iterator over the SortedMap.
     * @returns The iterator.
     */
    getIterator<T>(resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getIteratorFrom<T>(key: K, resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIteratorFrom<T>(key: K, resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIterator<T>(resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
}

/**
 * An iterator over an LLRBNode.
 */
declare class SortedMapIterator<K, V, T> {
    private isReverse_;
    private resultGenerator_;
    private nodeStack_;
    /**
     * @param node - Node to iterate.
     * @param isReverse_ - Whether or not to iterate in reverse
     */
    constructor(node: LLRBNode<K, V> | LLRBEmptyNode<K, V>, startKey: K | null, comparator: Comparator<K>, isReverse_: boolean, resultGenerator_?: ((k: K, v: V) => T) | null);
    getNext(): T;
    hasNext(): boolean;
    peek(): T;
}

/**
 * Helper class to store a sparse set of snapshots.
 */
declare interface SparseSnapshotTree {
    value: Node_2 | null;
    readonly children: Map<string, SparseSnapshotTree>;
}

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
/**
 * Tracks a collection of stats.
 */
declare class StatsCollection {
    private counters_;
    incrementCounter(name: string, amount?: number): void;
    get(): {
        [k: string]: number;
    };
}

/**
 * Returns the delta from the previous call to get stats.
 *
 * @param collection_ - The collection to "listen" to.
 */
declare class StatsListener {
    private collection_;
    private last_;
    constructor(collection_: StatsCollection);
    get(): {
        [k: string]: number;
    };
}

declare class StatsReporter {
    private server_;
    private statsListener_;
    statsToReport_: {
        [k: string]: boolean;
    };
    constructor(collection: StatsCollection, server_: ServerActions);
    private reportStats_;
}

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
declare class SyncPoint {
    /**
     * The Views being tracked at this location in the tree, stored as a map where the key is a
     * queryId and the value is the View for that query.
     *
     * NOTE: This list will be quite small (usually 1, but perhaps 2 or 3; any more is an odd use case).
     */
    readonly views: Map<string, View>;
}

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
declare class SyncTree {
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
 * Forces the RepoManager to create Repos that use ReadonlyRestClient instead of PersistentConnection.
 * @internal
 */
export declare const _TEST_ACCESS_forceRestClient: (forceRestClient: boolean) => void;

/**
 * @internal
 */
export declare const _TEST_ACCESS_hijackHash: (newHash: () => string) => () => void;

/**
 * A `Promise` that can also act as a `DatabaseReference` when returned by
 * {@link push}. The reference is available immediately and the `Promise` resolves
 * as the write to the backend completes.
 */
export declare interface ThenableReference extends DatabaseReference, Pick<Promise<DatabaseReference>, 'then' | 'catch'> {
    key: string;
    parent: DatabaseReference;
}

declare interface Transaction {
    path: Path;
    update: (a: unknown) => unknown;
    onComplete: (error: Error | null, committed: boolean, node: Node_2 | null) => void;
    status: TransactionStatus;
    order: number;
    applyLocally: boolean;
    retryCount: number;
    unwatcher: () => void;
    abortReason: string | null;
    currentWriteId: number;
    currentInputSnapshot: Node_2 | null;
    currentOutputSnapshotRaw: Node_2 | null;
    currentOutputSnapshotResolved: Node_2 | null;
}

/** An options object to configure transactions. */
export declare interface TransactionOptions {
    /**
     * By default, events are raised each time the transaction update function
     * runs. So if it is run multiple times, you may see intermediate states. You
     * can set this to false to suppress these intermediate states and instead
     * wait until the transaction has completed before events are raised.
     */
    readonly applyLocally?: boolean;
}

/**
 * A type for the resolve value of {@link runTransaction}.
 */
export declare class TransactionResult {
    /** Whether the transaction was successfully committed. */
    readonly committed: boolean;
    /** The resulting data snapshot. */
    readonly snapshot: DataSnapshot;
    /** @hideconstructor */
    constructor(
    /** Whether the transaction was successfully committed. */
    committed: boolean, 
    /** The resulting data snapshot. */
    snapshot: DataSnapshot);
    /** Returns a JSON-serializable representation of this object. */
    toJSON(): object;
}

declare const enum TransactionStatus {
    RUN = 0,
    SENT = 1,
    COMPLETED = 2,
    SENT_NEEDS_ABORT = 3,
    NEEDS_ABORT = 4
}

/**
 * A light-weight tree, traversable by path.  Nodes can have both values and children.
 * Nodes are not enumerated (by forEachChild) unless they have a value or non-empty
 * children.
 */
declare class Tree<T> {
    readonly name: string;
    readonly parent: Tree<T> | null;
    node: TreeNode<T>;
    /**
     * @param name - Optional name of the node.
     * @param parent - Optional parent node.
     * @param node - Optional node to wrap.
     */
    constructor(name?: string, parent?: Tree<T> | null, node?: TreeNode<T>);
}

/**
 * Node in a Tree.
 */
declare interface TreeNode<T> {
    children: Record<string, TreeNode<T>>;
    childCount: number;
    value?: T;
}

/** A callback that can invoked to remove a listener. */
export declare type Unsubscribe = () => void;

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
 * A user callback. Callbacks issues from the Legacy SDK maintain references
 * to the original user-issued callbacks, which allows equality
 * comparison by reference even though this callbacks are wrapped before
 * they can be passed to the firebase@exp SDK.
 *
 * @internal
 */
export declare interface _UserCallback {
    (dataSnapshot: DataSnapshot, previousChildName?: string | null): unknown;
    userCallback?: unknown;
    context?: object | null;
}

/**
 * @internal
 */
export declare const _validatePathString: (fnName: string, argumentName: string, pathString: string, optional: boolean) => void;

/**
 * @internal
 */
export declare const _validateWritablePath: (fnName: string, path: Path) => void;

/**
 * A view represents a specific location and query that has 1 or more event registrations.
 *
 * It does several things:
 *  - Maintains the list of event registrations for this location/query.
 *  - Maintains a cache of the data visible for this location/query.
 *  - Applies new operations (via applyOperation), updates the cache, and based on the event
 *    registrations returns the set of events to be raised.
 */
declare class View {
    private query_;
    processor_: ViewProcessor;
    viewCache_: ViewCache;
    eventRegistrations_: EventRegistration[];
    eventGenerator_: EventGenerator;
    constructor(query_: QueryContext, initialViewCache: ViewCache);
    get query(): QueryContext;
}

/**
 * Stores the data we have cached for a view.
 *
 * serverSnap is the cached server data, eventSnap is the cached event data (server data plus any local writes).
 */
declare interface ViewCache {
    readonly eventCache: CacheNode;
    readonly serverCache: CacheNode;
}

declare interface ViewProcessor {
    readonly filter: NodeFilter_2;
}

/**
 * Defines a single user-initiated write operation. May be the result of a set(), transaction(), or update() call. In
 * the case of a set() or transaction, snap will be non-null.  In the case of an update(), children will be non-null.
 */
declare interface WriteRecord {
    writeId: number;
    path: Path;
    snap?: Node_2 | null;
    children?: {
        [k: string]: Node_2;
    } | null;
    visible: boolean;
}

/**
 * WriteTree tracks all pending user-initiated writes and has methods to calculate the result of merging them
 * with underlying server data (to create "event cache" data).  Pending writes are added with addOverwrite()
 * and addMerge(), and removed with removeWrite().
 */
declare interface WriteTree {
    /**
     * A tree tracking the result of applying all visible writes.  This does not include transactions with
     * applyLocally=false or writes that are completely shadowed by other writes.
     */
    visibleWrites: CompoundWrite;
    /**
     * A list of all pending writes, regardless of visibility and shadowed-ness.  Used to calculate arbitrary
     * sets of the changed data, such as hidden writes (from transactions) or changes with certain writes excluded (also
     * used by transactions).
     */
    allWrites: WriteRecord[];
    lastWriteId: number;
}

export { }
