import firebase from '@firebase/app-compat';
import { ComponentContainer, Provider, Component } from '@firebase/component';
import { _validatePathString, onChildMoved, onChildChanged, onChildRemoved, onChildAdded, onValue, off, get, query, limitToFirst, limitToLast, orderByChild, orderByKey, orderByPriority, orderByValue, startAt, startAfter, endAt, endBefore, equalTo, _ReferenceImpl, _QueryImpl, _QueryParams, child, set, _validateWritablePath, update, setWithPriority, remove, runTransaction, setPriority, push, OnDisconnect as OnDisconnect$1, forceWebSockets, forceLongPolling, connectDatabaseEmulator, refFromURL, ref, goOffline, goOnline, serverTimestamp, increment, _setSDKVersion, _repoManagerDatabaseFromApp, enableLogging } from '@firebase/database';
import { errorPrefix, validateArgCount, validateCallback, validateContextObject, Deferred } from '@firebase/util';
import { Logger } from '@firebase/logger';

const name = "@firebase/database-compat";
const version = "2.1.0";

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
const logClient = new Logger('@firebase/database-compat');
const warn = function (msg) {
    const message = 'FIREBASE WARNING: ' + msg;
    logClient.warn(message);
};

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
const validateBoolean = function (fnName, argumentName, bool, optional) {
    if (optional && bool === undefined) {
        return;
    }
    if (typeof bool !== 'boolean') {
        throw new Error(errorPrefix(fnName, argumentName) + 'must be a boolean.');
    }
};
const validateEventType = function (fnName, eventType, optional) {
    if (optional && eventType === undefined) {
        return;
    }
    switch (eventType) {
        case 'value':
        case 'child_added':
        case 'child_removed':
        case 'child_changed':
        case 'child_moved':
            break;
        default:
            throw new Error(errorPrefix(fnName, 'eventType') +
                'must be a valid event type = "value", "child_added", "child_removed", ' +
                '"child_changed", or "child_moved".');
    }
};

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
class OnDisconnect {
    constructor(_delegate) {
        this._delegate = _delegate;
    }
    cancel(onComplete) {
        validateArgCount('OnDisconnect.cancel', 0, 1, arguments.length);
        validateCallback('OnDisconnect.cancel', 'onComplete', onComplete, true);
        const result = this._delegate.cancel();
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    remove(onComplete) {
        validateArgCount('OnDisconnect.remove', 0, 1, arguments.length);
        validateCallback('OnDisconnect.remove', 'onComplete', onComplete, true);
        const result = this._delegate.remove();
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    set(value, onComplete) {
        validateArgCount('OnDisconnect.set', 1, 2, arguments.length);
        validateCallback('OnDisconnect.set', 'onComplete', onComplete, true);
        const result = this._delegate.set(value);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    setWithPriority(value, priority, onComplete) {
        validateArgCount('OnDisconnect.setWithPriority', 2, 3, arguments.length);
        validateCallback('OnDisconnect.setWithPriority', 'onComplete', onComplete, true);
        const result = this._delegate.setWithPriority(value, priority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    update(objectToMerge, onComplete) {
        validateArgCount('OnDisconnect.update', 1, 2, arguments.length);
        if (Array.isArray(objectToMerge)) {
            const newObjectToMerge = {};
            for (let i = 0; i < objectToMerge.length; ++i) {
                newObjectToMerge['' + i] = objectToMerge[i];
            }
            objectToMerge = newObjectToMerge;
            warn('Passing an Array to firebase.database.onDisconnect().update() is deprecated. Use set() if you want to overwrite the ' +
                'existing data, or an Object with integer keys if you really do want to only update some of the children.');
        }
        validateCallback('OnDisconnect.update', 'onComplete', onComplete, true);
        const result = this._delegate.update(objectToMerge);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
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
class TransactionResult {
    /**
     * A type for the resolve value of Firebase.transaction.
     */
    constructor(committed, snapshot) {
        this.committed = committed;
        this.snapshot = snapshot;
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users
    toJSON() {
        validateArgCount('TransactionResult.toJSON', 0, 1, arguments.length);
        return { committed: this.committed, snapshot: this.snapshot.toJSON() };
    }
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
 * Class representing a firebase data snapshot.  It wraps a SnapshotNode and
 * surfaces the public methods (val, forEach, etc.) we want to expose.
 */
class DataSnapshot {
    constructor(_database, _delegate) {
        this._database = _database;
        this._delegate = _delegate;
    }
    /**
     * Retrieves the snapshot contents as JSON.  Returns null if the snapshot is
     * empty.
     *
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    val() {
        validateArgCount('DataSnapshot.val', 0, 0, arguments.length);
        return this._delegate.val();
    }
    /**
     * Returns the snapshot contents as JSON, including priorities of node.  Suitable for exporting
     * the entire node contents.
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    exportVal() {
        validateArgCount('DataSnapshot.exportVal', 0, 0, arguments.length);
        return this._delegate.exportVal();
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users
    toJSON() {
        // Optional spacer argument is unnecessary because we're depending on recursion rather than stringifying the content
        validateArgCount('DataSnapshot.toJSON', 0, 1, arguments.length);
        return this._delegate.toJSON();
    }
    /**
     * Returns whether the snapshot contains a non-null value.
     *
     * @returns Whether the snapshot contains a non-null value, or is empty.
     */
    exists() {
        validateArgCount('DataSnapshot.exists', 0, 0, arguments.length);
        return this._delegate.exists();
    }
    /**
     * Returns a DataSnapshot of the specified child node's contents.
     *
     * @param path - Path to a child.
     * @returns DataSnapshot for child node.
     */
    child(path) {
        validateArgCount('DataSnapshot.child', 0, 1, arguments.length);
        // Ensure the childPath is a string (can be a number)
        path = String(path);
        _validatePathString('DataSnapshot.child', 'path', path, false);
        return new DataSnapshot(this._database, this._delegate.child(path));
    }
    /**
     * Returns whether the snapshot contains a child at the specified path.
     *
     * @param path - Path to a child.
     * @returns Whether the child exists.
     */
    hasChild(path) {
        validateArgCount('DataSnapshot.hasChild', 1, 1, arguments.length);
        _validatePathString('DataSnapshot.hasChild', 'path', path, false);
        return this._delegate.hasChild(path);
    }
    /**
     * Returns the priority of the object, or null if no priority was set.
     *
     * @returns The priority.
     */
    getPriority() {
        validateArgCount('DataSnapshot.getPriority', 0, 0, arguments.length);
        return this._delegate.priority;
    }
    /**
     * Iterates through child nodes and calls the specified action for each one.
     *
     * @param action - Callback function to be called
     * for each child.
     * @returns True if forEach was canceled by action returning true for
     * one of the child nodes.
     */
    forEach(action) {
        validateArgCount('DataSnapshot.forEach', 1, 1, arguments.length);
        validateCallback('DataSnapshot.forEach', 'action', action, false);
        return this._delegate.forEach(expDataSnapshot => action(new DataSnapshot(this._database, expDataSnapshot)));
    }
    /**
     * Returns whether this DataSnapshot has children.
     * @returns True if the DataSnapshot contains 1 or more child nodes.
     */
    hasChildren() {
        validateArgCount('DataSnapshot.hasChildren', 0, 0, arguments.length);
        return this._delegate.hasChildren();
    }
    get key() {
        return this._delegate.key;
    }
    /**
     * Returns the number of children for this DataSnapshot.
     * @returns The number of children that this DataSnapshot contains.
     */
    numChildren() {
        validateArgCount('DataSnapshot.numChildren', 0, 0, arguments.length);
        return this._delegate.size;
    }
    /**
     * @returns The Firebase reference for the location this snapshot's data came
     * from.
     */
    getRef() {
        validateArgCount('DataSnapshot.ref', 0, 0, arguments.length);
        return new Reference(this._database, this._delegate.ref);
    }
    get ref() {
        return this.getRef();
    }
}
/**
 * A Query represents a filter to be applied to a firebase location.  This object purely represents the
 * query expression (and exposes our public API to build the query).  The actual query logic is in ViewBase.js.
 *
 * Since every Firebase reference is a query, Firebase inherits from this object.
 */
class Query {
    constructor(database, _delegate) {
        this.database = database;
        this._delegate = _delegate;
    }
    on(eventType, callback, cancelCallbackOrContext, context) {
        validateArgCount('Query.on', 2, 4, arguments.length);
        validateCallback('Query.on', 'callback', callback, false);
        const ret = Query.getCancelAndContextArgs_('Query.on', cancelCallbackOrContext, context);
        const valueCallback = (expSnapshot, previousChildName) => {
            callback.call(ret.context, new DataSnapshot(this.database, expSnapshot), previousChildName);
        };
        valueCallback.userCallback = callback;
        valueCallback.context = ret.context;
        const cancelCallback = ret.cancel?.bind(ret.context);
        switch (eventType) {
            case 'value':
                onValue(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_added':
                onChildAdded(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_removed':
                onChildRemoved(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_changed':
                onChildChanged(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_moved':
                onChildMoved(this._delegate, valueCallback, cancelCallback);
                return callback;
            default:
                throw new Error(errorPrefix('Query.on', 'eventType') +
                    'must be a valid event type = "value", "child_added", "child_removed", ' +
                    '"child_changed", or "child_moved".');
        }
    }
    off(eventType, callback, context) {
        validateArgCount('Query.off', 0, 3, arguments.length);
        validateEventType('Query.off', eventType, true);
        validateCallback('Query.off', 'callback', callback, true);
        validateContextObject('Query.off', 'context', context, true);
        if (callback) {
            const valueCallback = () => { };
            valueCallback.userCallback = callback;
            valueCallback.context = context;
            off(this._delegate, eventType, valueCallback);
        }
        else {
            off(this._delegate, eventType);
        }
    }
    /**
     * Get the server-value for this query, or return a cached value if not connected.
     */
    get() {
        return get(this._delegate).then(expSnapshot => {
            return new DataSnapshot(this.database, expSnapshot);
        });
    }
    /**
     * Attaches a listener, waits for the first event, and then removes the listener
     */
    once(eventType, callback, failureCallbackOrContext, context) {
        validateArgCount('Query.once', 1, 4, arguments.length);
        validateCallback('Query.once', 'callback', callback, true);
        const ret = Query.getCancelAndContextArgs_('Query.once', failureCallbackOrContext, context);
        const deferred = new Deferred();
        const valueCallback = (expSnapshot, previousChildName) => {
            const result = new DataSnapshot(this.database, expSnapshot);
            if (callback) {
                callback.call(ret.context, result, previousChildName);
            }
            deferred.resolve(result);
        };
        valueCallback.userCallback = callback;
        valueCallback.context = ret.context;
        const cancelCallback = (error) => {
            if (ret.cancel) {
                ret.cancel.call(ret.context, error);
            }
            deferred.reject(error);
        };
        switch (eventType) {
            case 'value':
                onValue(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_added':
                onChildAdded(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_removed':
                onChildRemoved(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_changed':
                onChildChanged(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_moved':
                onChildMoved(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            default:
                throw new Error(errorPrefix('Query.once', 'eventType') +
                    'must be a valid event type = "value", "child_added", "child_removed", ' +
                    '"child_changed", or "child_moved".');
        }
        return deferred.promise;
    }
    /**
     * Set a limit and anchor it to the start of the window.
     */
    limitToFirst(limit) {
        validateArgCount('Query.limitToFirst', 1, 1, arguments.length);
        return new Query(this.database, query(this._delegate, limitToFirst(limit)));
    }
    /**
     * Set a limit and anchor it to the end of the window.
     */
    limitToLast(limit) {
        validateArgCount('Query.limitToLast', 1, 1, arguments.length);
        return new Query(this.database, query(this._delegate, limitToLast(limit)));
    }
    /**
     * Given a child path, return a new query ordered by the specified grandchild path.
     */
    orderByChild(path) {
        validateArgCount('Query.orderByChild', 1, 1, arguments.length);
        return new Query(this.database, query(this._delegate, orderByChild(path)));
    }
    /**
     * Return a new query ordered by the KeyIndex
     */
    orderByKey() {
        validateArgCount('Query.orderByKey', 0, 0, arguments.length);
        return new Query(this.database, query(this._delegate, orderByKey()));
    }
    /**
     * Return a new query ordered by the PriorityIndex
     */
    orderByPriority() {
        validateArgCount('Query.orderByPriority', 0, 0, arguments.length);
        return new Query(this.database, query(this._delegate, orderByPriority()));
    }
    /**
     * Return a new query ordered by the ValueIndex
     */
    orderByValue() {
        validateArgCount('Query.orderByValue', 0, 0, arguments.length);
        return new Query(this.database, query(this._delegate, orderByValue()));
    }
    startAt(value = null, name) {
        validateArgCount('Query.startAt', 0, 2, arguments.length);
        return new Query(this.database, query(this._delegate, startAt(value, name)));
    }
    startAfter(value = null, name) {
        validateArgCount('Query.startAfter', 0, 2, arguments.length);
        return new Query(this.database, query(this._delegate, startAfter(value, name)));
    }
    endAt(value = null, name) {
        validateArgCount('Query.endAt', 0, 2, arguments.length);
        return new Query(this.database, query(this._delegate, endAt(value, name)));
    }
    endBefore(value = null, name) {
        validateArgCount('Query.endBefore', 0, 2, arguments.length);
        return new Query(this.database, query(this._delegate, endBefore(value, name)));
    }
    /**
     * Load the selection of children with exactly the specified value, and, optionally,
     * the specified name.
     */
    equalTo(value, name) {
        validateArgCount('Query.equalTo', 1, 2, arguments.length);
        return new Query(this.database, query(this._delegate, equalTo(value, name)));
    }
    /**
     * @returns URL for this location.
     */
    toString() {
        validateArgCount('Query.toString', 0, 0, arguments.length);
        return this._delegate.toString();
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users.
    toJSON() {
        // An optional spacer argument is unnecessary for a string.
        validateArgCount('Query.toJSON', 0, 1, arguments.length);
        return this._delegate.toJSON();
    }
    /**
     * Return true if this query and the provided query are equivalent; otherwise, return false.
     */
    isEqual(other) {
        validateArgCount('Query.isEqual', 1, 1, arguments.length);
        if (!(other instanceof Query)) {
            const error = 'Query.isEqual failed: First argument must be an instance of firebase.database.Query.';
            throw new Error(error);
        }
        return this._delegate.isEqual(other._delegate);
    }
    /**
     * Helper used by .on and .once to extract the context and or cancel arguments.
     * @param fnName - The function name (on or once)
     *
     */
    static getCancelAndContextArgs_(fnName, cancelOrContext, context) {
        const ret = { cancel: undefined, context: undefined };
        if (cancelOrContext && context) {
            ret.cancel = cancelOrContext;
            validateCallback(fnName, 'cancel', ret.cancel, true);
            ret.context = context;
            validateContextObject(fnName, 'context', ret.context, true);
        }
        else if (cancelOrContext) {
            // we have either a cancel callback or a context.
            if (typeof cancelOrContext === 'object' && cancelOrContext !== null) {
                // it's a context!
                ret.context = cancelOrContext;
            }
            else if (typeof cancelOrContext === 'function') {
                ret.cancel = cancelOrContext;
            }
            else {
                throw new Error(errorPrefix(fnName, 'cancelOrContext') +
                    ' must either be a cancel callback or a context object.');
            }
        }
        return ret;
    }
    get ref() {
        return new Reference(this.database, new _ReferenceImpl(this._delegate._repo, this._delegate._path));
    }
}
class Reference extends Query {
    /**
     * Call options:
     *   new Reference(Repo, Path) or
     *   new Reference(url: string, string|RepoManager)
     *
     * Externally - this is the firebase.database.Reference type.
     */
    constructor(database, _delegate) {
        super(database, new _QueryImpl(_delegate._repo, _delegate._path, new _QueryParams(), false));
        this.database = database;
        this._delegate = _delegate;
    }
    /** @returns {?string} */
    getKey() {
        validateArgCount('Reference.key', 0, 0, arguments.length);
        return this._delegate.key;
    }
    child(pathString) {
        validateArgCount('Reference.child', 1, 1, arguments.length);
        if (typeof pathString === 'number') {
            pathString = String(pathString);
        }
        return new Reference(this.database, child(this._delegate, pathString));
    }
    /** @returns {?Reference} */
    getParent() {
        validateArgCount('Reference.parent', 0, 0, arguments.length);
        const parent = this._delegate.parent;
        return parent ? new Reference(this.database, parent) : null;
    }
    /** @returns {!Reference} */
    getRoot() {
        validateArgCount('Reference.root', 0, 0, arguments.length);
        return new Reference(this.database, this._delegate.root);
    }
    set(newVal, onComplete) {
        validateArgCount('Reference.set', 1, 2, arguments.length);
        validateCallback('Reference.set', 'onComplete', onComplete, true);
        const result = set(this._delegate, newVal);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    update(values, onComplete) {
        validateArgCount('Reference.update', 1, 2, arguments.length);
        if (Array.isArray(values)) {
            const newObjectToMerge = {};
            for (let i = 0; i < values.length; ++i) {
                newObjectToMerge['' + i] = values[i];
            }
            values = newObjectToMerge;
            warn('Passing an Array to Firebase.update() is deprecated. ' +
                'Use set() if you want to overwrite the existing data, or ' +
                'an Object with integer keys if you really do want to ' +
                'only update some of the children.');
        }
        _validateWritablePath('Reference.update', this._delegate._path);
        validateCallback('Reference.update', 'onComplete', onComplete, true);
        const result = update(this._delegate, values);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    setWithPriority(newVal, newPriority, onComplete) {
        validateArgCount('Reference.setWithPriority', 2, 3, arguments.length);
        validateCallback('Reference.setWithPriority', 'onComplete', onComplete, true);
        const result = setWithPriority(this._delegate, newVal, newPriority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    remove(onComplete) {
        validateArgCount('Reference.remove', 0, 1, arguments.length);
        validateCallback('Reference.remove', 'onComplete', onComplete, true);
        const result = remove(this._delegate);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    transaction(transactionUpdate, onComplete, applyLocally) {
        validateArgCount('Reference.transaction', 1, 3, arguments.length);
        validateCallback('Reference.transaction', 'transactionUpdate', transactionUpdate, false);
        validateCallback('Reference.transaction', 'onComplete', onComplete, true);
        validateBoolean('Reference.transaction', 'applyLocally', applyLocally, true);
        const result = runTransaction(this._delegate, transactionUpdate, {
            applyLocally
        }).then(transactionResult => new TransactionResult(transactionResult.committed, new DataSnapshot(this.database, transactionResult.snapshot)));
        if (onComplete) {
            result.then(transactionResult => onComplete(null, transactionResult.committed, transactionResult.snapshot), error => onComplete(error, false, null));
        }
        return result;
    }
    setPriority(priority, onComplete) {
        validateArgCount('Reference.setPriority', 1, 2, arguments.length);
        validateCallback('Reference.setPriority', 'onComplete', onComplete, true);
        const result = setPriority(this._delegate, priority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    push(value, onComplete) {
        validateArgCount('Reference.push', 0, 2, arguments.length);
        validateCallback('Reference.push', 'onComplete', onComplete, true);
        const expPromise = push(this._delegate, value);
        const promise = expPromise.then(expRef => new Reference(this.database, expRef));
        if (onComplete) {
            promise.then(() => onComplete(null), error => onComplete(error));
        }
        const result = new Reference(this.database, expPromise);
        result.then = promise.then.bind(promise);
        result.catch = promise.catch.bind(promise, undefined);
        return result;
    }
    onDisconnect() {
        _validateWritablePath('Reference.onDisconnect', this._delegate._path);
        return new OnDisconnect(new OnDisconnect$1(this._delegate._repo, this._delegate._path));
    }
    get key() {
        return this.getKey();
    }
    get parent() {
        return this.getParent();
    }
    get root() {
        return this.getRoot();
    }
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
 * Class representing a firebase database.
 */
class Database {
    /**
     * The constructor should not be called by users of our public API.
     */
    constructor(_delegate, app) {
        this._delegate = _delegate;
        this.app = app;
        this.INTERNAL = {
            delete: () => this._delegate._delete(),
            forceWebSockets,
            forceLongPolling
        };
    }
    /**
     * Modify this instance to communicate with the Realtime Database emulator.
     *
     * <p>Note: This method must be called before performing any other operation.
     *
     * @param host - the emulator host (ex: localhost)
     * @param port - the emulator port (ex: 8080)
     * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
     */
    useEmulator(host, port, options = {}) {
        connectDatabaseEmulator(this._delegate, host, port, options);
    }
    ref(path) {
        validateArgCount('database.ref', 0, 1, arguments.length);
        if (path instanceof Reference) {
            const childRef = refFromURL(this._delegate, path.toString());
            return new Reference(this, childRef);
        }
        else {
            const childRef = ref(this._delegate, path);
            return new Reference(this, childRef);
        }
    }
    /**
     * Returns a reference to the root or the path specified in url.
     * We throw a exception if the url is not in the same domain as the
     * current repo.
     * @returns Firebase reference.
     */
    refFromURL(url) {
        const apiName = 'database.refFromURL';
        validateArgCount(apiName, 1, 1, arguments.length);
        const childRef = refFromURL(this._delegate, url);
        return new Reference(this, childRef);
    }
    // Make individual repo go offline.
    goOffline() {
        validateArgCount('database.goOffline', 0, 0, arguments.length);
        return goOffline(this._delegate);
    }
    goOnline() {
        validateArgCount('database.goOnline', 0, 0, arguments.length);
        return goOnline(this._delegate);
    }
}
Database.ServerValue = {
    TIMESTAMP: serverTimestamp(),
    increment: (delta) => increment(delta)
};

/**
 * Used by console to create a database based on the app,
 * passed database URL and a custom auth implementation.
 *
 * @param app - A valid FirebaseApp-like object
 * @param url - A valid Firebase databaseURL
 * @param version - custom version e.g. firebase-admin version
 * @param customAuthImpl - custom auth implementation
 */
function initStandalone({ app, url, version, customAuthImpl, customAppCheckImpl, namespace, nodeAdmin = false }) {
    _setSDKVersion(version);
    const container = new ComponentContainer('database-standalone');
    /**
     * ComponentContainer('database-standalone') is just a placeholder that doesn't perform
     * any actual function.
     */
    const authProvider = new Provider('auth-internal', container);
    authProvider.setComponent(new Component('auth-internal', () => customAuthImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    let appCheckProvider = undefined;
    if (customAppCheckImpl) {
        appCheckProvider = new Provider('app-check-internal', container);
        appCheckProvider.setComponent(new Component('app-check-internal', () => customAppCheckImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    }
    return {
        instance: new Database(_repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url, nodeAdmin), app),
        namespace
    };
}

var INTERNAL = /*#__PURE__*/Object.freeze({
  __proto__: null,
  initStandalone: initStandalone
});

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
const ServerValue = Database.ServerValue;
function registerDatabase(instance) {
    // Register the Database Service with the 'firebase' namespace.
    instance.INTERNAL.registerComponent(new Component('database-compat', (container, { instanceIdentifier: url }) => {
        /* Dependencies */
        // getImmediate for FirebaseApp will always succeed
        const app = container.getProvider('app-compat').getImmediate();
        const databaseExp = container
            .getProvider('database')
            .getImmediate({ identifier: url });
        return new Database(databaseExp, app);
    }, "PUBLIC" /* ComponentType.PUBLIC */)
        .setServiceProps(
    // firebase.database namespace properties
    {
        Reference,
        Query,
        Database,
        DataSnapshot,
        enableLogging,
        INTERNAL,
        ServerValue
    })
        .setMultipleInstances(true));
    instance.registerVersion(name, version);
}
registerDatabase(firebase);

export { registerDatabase };
//# sourceMappingURL=index.esm.js.map
