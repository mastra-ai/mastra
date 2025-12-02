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
import { DataSnapshot as ModularDataSnapshot, Query as ExpQuery, DatabaseReference as ModularReference } from '@firebase/database';
import { Compat } from '@firebase/util';
import { Database } from './Database';
import { OnDisconnect } from './onDisconnect';
import { TransactionResult } from './TransactionResult';
/**
 * Class representing a firebase data snapshot.  It wraps a SnapshotNode and
 * surfaces the public methods (val, forEach, etc.) we want to expose.
 */
export declare class DataSnapshot implements Compat<ModularDataSnapshot> {
    readonly _database: Database;
    readonly _delegate: ModularDataSnapshot;
    constructor(_database: Database, _delegate: ModularDataSnapshot);
    /**
     * Retrieves the snapshot contents as JSON.  Returns null if the snapshot is
     * empty.
     *
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    val(): unknown;
    /**
     * Returns the snapshot contents as JSON, including priorities of node.  Suitable for exporting
     * the entire node contents.
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    exportVal(): unknown;
    toJSON(): unknown;
    /**
     * Returns whether the snapshot contains a non-null value.
     *
     * @returns Whether the snapshot contains a non-null value, or is empty.
     */
    exists(): boolean;
    /**
     * Returns a DataSnapshot of the specified child node's contents.
     *
     * @param path - Path to a child.
     * @returns DataSnapshot for child node.
     */
    child(path: string): DataSnapshot;
    /**
     * Returns whether the snapshot contains a child at the specified path.
     *
     * @param path - Path to a child.
     * @returns Whether the child exists.
     */
    hasChild(path: string): boolean;
    /**
     * Returns the priority of the object, or null if no priority was set.
     *
     * @returns The priority.
     */
    getPriority(): string | number | null;
    /**
     * Iterates through child nodes and calls the specified action for each one.
     *
     * @param action - Callback function to be called
     * for each child.
     * @returns True if forEach was canceled by action returning true for
     * one of the child nodes.
     */
    forEach(action: (snapshot: IteratedDataSnapshot) => boolean | void): boolean;
    /**
     * Returns whether this DataSnapshot has children.
     * @returns True if the DataSnapshot contains 1 or more child nodes.
     */
    hasChildren(): boolean;
    get key(): string;
    /**
     * Returns the number of children for this DataSnapshot.
     * @returns The number of children that this DataSnapshot contains.
     */
    numChildren(): number;
    /**
     * @returns The Firebase reference for the location this snapshot's data came
     * from.
     */
    getRef(): Reference;
    get ref(): Reference;
}
/**
 * Represents a child snapshot of a `Reference` that is being iterated over. The key will never be undefined.
 */
export interface IteratedDataSnapshot extends DataSnapshot {
    key: string;
}
export interface SnapshotCallback {
    (dataSnapshot: DataSnapshot, previousChildName?: string | null): unknown;
}
/**
 * A Query represents a filter to be applied to a firebase location.  This object purely represents the
 * query expression (and exposes our public API to build the query).  The actual query logic is in ViewBase.js.
 *
 * Since every Firebase reference is a query, Firebase inherits from this object.
 */
export declare class Query implements Compat<ExpQuery> {
    readonly database: Database;
    readonly _delegate: ExpQuery;
    constructor(database: Database, _delegate: ExpQuery);
    on(eventType: string, callback: SnapshotCallback, cancelCallbackOrContext?: ((a: Error) => unknown) | object | null, context?: object | null): SnapshotCallback;
    off(eventType?: string, callback?: SnapshotCallback, context?: object | null): void;
    /**
     * Get the server-value for this query, or return a cached value if not connected.
     */
    get(): Promise<DataSnapshot>;
    /**
     * Attaches a listener, waits for the first event, and then removes the listener
     */
    once(eventType: string, callback?: SnapshotCallback, failureCallbackOrContext?: ((a: Error) => void) | object | null, context?: object | null): Promise<DataSnapshot>;
    /**
     * Set a limit and anchor it to the start of the window.
     */
    limitToFirst(limit: number): Query;
    /**
     * Set a limit and anchor it to the end of the window.
     */
    limitToLast(limit: number): Query;
    /**
     * Given a child path, return a new query ordered by the specified grandchild path.
     */
    orderByChild(path: string): Query;
    /**
     * Return a new query ordered by the KeyIndex
     */
    orderByKey(): Query;
    /**
     * Return a new query ordered by the PriorityIndex
     */
    orderByPriority(): Query;
    /**
     * Return a new query ordered by the ValueIndex
     */
    orderByValue(): Query;
    startAt(value?: number | string | boolean | null, name?: string | null): Query;
    startAfter(value?: number | string | boolean | null, name?: string | null): Query;
    endAt(value?: number | string | boolean | null, name?: string | null): Query;
    endBefore(value?: number | string | boolean | null, name?: string | null): Query;
    /**
     * Load the selection of children with exactly the specified value, and, optionally,
     * the specified name.
     */
    equalTo(value: number | string | boolean | null, name?: string): Query;
    /**
     * @returns URL for this location.
     */
    toString(): string;
    toJSON(): string;
    /**
     * Return true if this query and the provided query are equivalent; otherwise, return false.
     */
    isEqual(other: Query): boolean;
    /**
     * Helper used by .on and .once to extract the context and or cancel arguments.
     * @param fnName - The function name (on or once)
     *
     */
    private static getCancelAndContextArgs_;
    get ref(): Reference;
}
export declare class Reference extends Query implements Compat<ModularReference> {
    readonly database: Database;
    readonly _delegate: ModularReference;
    then: Promise<Reference>['then'];
    catch: Promise<Reference>['catch'];
    /**
     * Call options:
     *   new Reference(Repo, Path) or
     *   new Reference(url: string, string|RepoManager)
     *
     * Externally - this is the firebase.database.Reference type.
     */
    constructor(database: Database, _delegate: ModularReference);
    /** @returns {?string} */
    getKey(): string | null;
    child(pathString: string): Reference;
    /** @returns {?Reference} */
    getParent(): Reference | null;
    /** @returns {!Reference} */
    getRoot(): Reference;
    set(newVal: unknown, onComplete?: (error: Error | null) => void): Promise<void>;
    update(values: object, onComplete?: (a: Error | null) => void): Promise<void>;
    setWithPriority(newVal: unknown, newPriority: string | number | null, onComplete?: (a: Error | null) => void): Promise<void>;
    remove(onComplete?: (a: Error | null) => void): Promise<void>;
    transaction(transactionUpdate: (currentData: unknown) => unknown, onComplete?: (error: Error | null, committed: boolean, dataSnapshot: DataSnapshot | null) => void, applyLocally?: boolean): Promise<TransactionResult>;
    setPriority(priority: string | number | null, onComplete?: (a: Error | null) => void): Promise<void>;
    push(value?: unknown, onComplete?: (a: Error | null) => void): Reference;
    onDisconnect(): OnDisconnect;
    get key(): string | null;
    get parent(): Reference | null;
    get root(): Reference;
}
