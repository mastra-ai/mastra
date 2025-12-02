import { Collection } from './collection';
import { NodeCallback } from './utilities';
/**
 * CouchbaseList provides a simplified interface for storing lists
 * within a Couchbase document.
 *
 * @see {@link Collection.list}
 * @category Datastructures
 */
export declare class CouchbaseList {
    private _coll;
    private _key;
    /**
     * @internal
     */
    constructor(collection: Collection, key: string);
    private _get;
    /**
     * Returns the entire list of items in this list.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    getAll(callback?: NodeCallback<any[]>): Promise<any[]>;
    /**
     * Iterates each item in the list.
     *
     * @param rowCallback A callback invoked for each item in the list.
     * @param callback A node-style callback to be invoked after execution.
     */
    forEach(rowCallback: (value: any, index: number, array: CouchbaseList) => void, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Provides the ability to async-for loop this object.
     */
    [Symbol.asyncIterator](): AsyncIterator<any>;
    /**
     * Retrieves the item at a specific index in the list.
     *
     * @param index The index to retrieve.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAt(index: number, callback?: NodeCallback<any>): Promise<any>;
    /**
     * Removes an item at a specific index from the list.
     *
     * @param index The index to remove.
     * @param callback A node-style callback to be invoked after execution.
     */
    removeAt(index: number, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns the index of a specific value from the list.
     *
     * @param value The value to search for.
     * @param callback A node-style callback to be invoked after execution.
     */
    indexOf(value: any, callback?: NodeCallback<number>): Promise<number>;
    /**
     * Returns the number of items in the list.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    size(callback?: NodeCallback<number>): Promise<number>;
    /**
     * Adds a new item to the end of the list.
     *
     * @param value The value to add.
     * @param callback A node-style callback to be invoked after execution.
     */
    push(value: any, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Adds a new item to the beginning of the list.
     *
     * @param value The value to add.
     * @param callback A node-style callback to be invoked after execution.
     */
    unshift(value: any, callback?: NodeCallback<void>): Promise<void>;
}
/**
 * CouchbaseMap provides a simplified interface for storing a map
 * within a Couchbase document.
 *
 * @see {@link Collection.map}
 * @category Datastructures
 */
export declare class CouchbaseMap {
    private _coll;
    private _key;
    /**
     * @internal
     */
    constructor(collection: Collection, key: string);
    private _get;
    /**
     * Returns an object representing all items in the map.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    getAll(callback?: NodeCallback<{
        [key: string]: any;
    }>): Promise<{
        [key: string]: any;
    }>;
    /**
     * Iterates through every item in the map.
     *
     * @param rowCallback A callback invoked for each item in the list.
     * @param callback A node-style callback to be invoked after execution.
     */
    forEach(rowCallback: (value: any, key: string, map: CouchbaseMap) => void, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Provides the ability to async-for loop this object.
     */
    [Symbol.asyncIterator](): AsyncIterator<[any, string]>;
    /**
     * Sets a specific to the specified value in the map.
     *
     * @param item The key in the map to set.
     * @param value The new value to set.
     * @param callback A node-style callback to be invoked after execution.
     */
    set(item: string, value: any, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches a specific key from the map.
     *
     * @param item The key in the map to retrieve.
     * @param callback A node-style callback to be invoked after execution.
     */
    get(item: string, callback?: NodeCallback<any>): Promise<any>;
    /**
     * Removes a specific key from the map.
     *
     * @param item The key in the map to remove.
     * @param callback A node-style callback to be invoked after execution.
     */
    remove(item: string, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Checks whether a specific key exists in the map.
     *
     * @param item The key in the map to search for.
     * @param callback A node-style callback to be invoked after execution.
     */
    exists(item: string, callback?: NodeCallback<boolean>): Promise<boolean>;
    /**
     * Returns a list of all the keys which exist in the map.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    keys(callback?: NodeCallback<string[]>): Promise<string[]>;
    /**
     * Returns a list of all the values which exist in the map.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    values(callback?: NodeCallback<any[]>): Promise<any[]>;
    /**
     * Returns the number of items that exist in the map.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    size(callback?: NodeCallback<number>): Promise<number>;
}
/**
 * CouchbaseQueue provides a simplified interface for storing a queue
 * within a Couchbase document.
 *
 * @see {@link Collection.queue}
 * @category Datastructures
 */
export declare class CouchbaseQueue {
    private _coll;
    private _key;
    /**
     * @internal
     */
    constructor(collection: Collection, key: string);
    private _get;
    /**
     * Returns the number of items in the queue.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    size(callback?: NodeCallback<number>): Promise<number>;
    /**
     * Adds a new item to the back of the queue.
     *
     * @param value The value to add.
     * @param callback A node-style callback to be invoked after execution.
     */
    push(value: any, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Removes an item from the front of the queue.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    pop(callback?: NodeCallback<any>): Promise<any>;
}
/**
 * CouchbaseSet provides a simplified interface for storing a set
 * within a Couchbase document.
 *
 * @see {@link Collection.set}
 * @category Datastructures
 */
export declare class CouchbaseSet {
    private _coll;
    private _key;
    /**
     * @internal
     */
    constructor(collection: Collection, key: string);
    private _get;
    /**
     * Adds a new item to the set.  Returning whether the item already existed
     * in the set or not.
     *
     * @param item The item to add.
     * @param callback A node-style callback to be invoked after execution.
     */
    add(item: any, callback?: NodeCallback<boolean>): Promise<boolean>;
    /**
     * Returns whether a specific value already exists in the set.
     *
     * @param item The value to search for.
     * @param callback A node-style callback to be invoked after execution.
     */
    contains(item: any, callback?: NodeCallback<boolean>): Promise<boolean>;
    /**
     * Removes a specific value from the set.
     *
     * @param item The value to remove.
     * @param callback A node-style callback to be invoked after execution.
     */
    remove(item: any, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of all values in the set.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    values(callback?: NodeCallback<any[]>): Promise<any[]>;
    /**
     * Returns the number of elements in this set.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    size(callback?: NodeCallback<number>): Promise<number>;
}
