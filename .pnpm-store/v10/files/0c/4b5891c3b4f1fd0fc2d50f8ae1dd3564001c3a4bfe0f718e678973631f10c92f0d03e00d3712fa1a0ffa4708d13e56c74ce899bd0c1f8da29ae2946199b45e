"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.List = void 0;
const Error_js_1 = require("./Error.js");
class List {
    constructor(list) {
        this.privSubscriptionIdCounter = 0;
        this.privAddSubscriptions = {};
        this.privRemoveSubscriptions = {};
        this.privDisposedSubscriptions = {};
        this.privDisposeReason = null;
        this.privList = [];
        // copy the list rather than taking as is.
        if (list) {
            for (const item of list) {
                this.privList.push(item);
            }
        }
    }
    get(itemIndex) {
        this.throwIfDisposed();
        return this.privList[itemIndex];
    }
    first() {
        return this.get(0);
    }
    last() {
        return this.get(this.length() - 1);
    }
    add(item) {
        this.throwIfDisposed();
        this.insertAt(this.privList.length, item);
    }
    insertAt(index, item) {
        this.throwIfDisposed();
        if (index === 0) {
            this.privList.unshift(item);
        }
        else if (index === this.privList.length) {
            this.privList.push(item);
        }
        else {
            this.privList.splice(index, 0, item);
        }
        this.triggerSubscriptions(this.privAddSubscriptions);
    }
    removeFirst() {
        this.throwIfDisposed();
        return this.removeAt(0);
    }
    removeLast() {
        this.throwIfDisposed();
        return this.removeAt(this.length() - 1);
    }
    removeAt(index) {
        this.throwIfDisposed();
        return this.remove(index, 1)[0];
    }
    remove(index, count) {
        this.throwIfDisposed();
        const removedElements = this.privList.splice(index, count);
        this.triggerSubscriptions(this.privRemoveSubscriptions);
        return removedElements;
    }
    clear() {
        this.throwIfDisposed();
        this.remove(0, this.length());
    }
    length() {
        this.throwIfDisposed();
        return this.privList.length;
    }
    onAdded(addedCallback) {
        this.throwIfDisposed();
        const subscriptionId = this.privSubscriptionIdCounter++;
        this.privAddSubscriptions[subscriptionId] = addedCallback;
        return {
            detach: () => {
                delete this.privAddSubscriptions[subscriptionId];
                return Promise.resolve();
            },
        };
    }
    onRemoved(removedCallback) {
        this.throwIfDisposed();
        const subscriptionId = this.privSubscriptionIdCounter++;
        this.privRemoveSubscriptions[subscriptionId] = removedCallback;
        return {
            detach: () => {
                delete this.privRemoveSubscriptions[subscriptionId];
                return Promise.resolve();
            },
        };
    }
    onDisposed(disposedCallback) {
        this.throwIfDisposed();
        const subscriptionId = this.privSubscriptionIdCounter++;
        this.privDisposedSubscriptions[subscriptionId] = disposedCallback;
        return {
            detach: () => {
                delete this.privDisposedSubscriptions[subscriptionId];
                return Promise.resolve();
            },
        };
    }
    join(seperator) {
        this.throwIfDisposed();
        return this.privList.join(seperator);
    }
    toArray() {
        const cloneCopy = Array();
        this.privList.forEach((val) => {
            cloneCopy.push(val);
        });
        return cloneCopy;
    }
    any(callback) {
        this.throwIfDisposed();
        if (callback) {
            return this.where(callback).length() > 0;
        }
        else {
            return this.length() > 0;
        }
    }
    all(callback) {
        this.throwIfDisposed();
        return this.where(callback).length() === this.length();
    }
    forEach(callback) {
        this.throwIfDisposed();
        for (let i = 0; i < this.length(); i++) {
            callback(this.privList[i], i);
        }
    }
    select(callback) {
        this.throwIfDisposed();
        const selectList = [];
        for (let i = 0; i < this.privList.length; i++) {
            selectList.push(callback(this.privList[i], i));
        }
        return new List(selectList);
    }
    where(callback) {
        this.throwIfDisposed();
        const filteredList = new List();
        for (let i = 0; i < this.privList.length; i++) {
            if (callback(this.privList[i], i)) {
                filteredList.add(this.privList[i]);
            }
        }
        return filteredList;
    }
    orderBy(compareFn) {
        this.throwIfDisposed();
        const clonedArray = this.toArray();
        const orderedArray = clonedArray.sort(compareFn);
        return new List(orderedArray);
    }
    orderByDesc(compareFn) {
        this.throwIfDisposed();
        return this.orderBy((a, b) => compareFn(b, a));
    }
    clone() {
        this.throwIfDisposed();
        return new List(this.toArray());
    }
    concat(list) {
        this.throwIfDisposed();
        return new List(this.privList.concat(list.toArray()));
    }
    concatArray(array) {
        this.throwIfDisposed();
        return new List(this.privList.concat(array));
    }
    isDisposed() {
        return this.privList == null;
    }
    dispose(reason) {
        if (!this.isDisposed()) {
            this.privDisposeReason = reason;
            this.privList = null;
            this.privAddSubscriptions = null;
            this.privRemoveSubscriptions = null;
            this.triggerSubscriptions(this.privDisposedSubscriptions);
        }
    }
    throwIfDisposed() {
        if (this.isDisposed()) {
            throw new Error_js_1.ObjectDisposedError("List", this.privDisposeReason);
        }
    }
    triggerSubscriptions(subscriptions) {
        if (subscriptions) {
            for (const subscriptionId in subscriptions) {
                if (subscriptionId) {
                    subscriptions[subscriptionId]();
                }
            }
        }
    }
}
exports.List = List;

//# sourceMappingURL=List.js.map
