"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const Error_js_1 = require("./Error.js");
const List_js_1 = require("./List.js");
const Promise_js_1 = require("./Promise.js");
var SubscriberType;
(function (SubscriberType) {
    SubscriberType[SubscriberType["Dequeue"] = 0] = "Dequeue";
    SubscriberType[SubscriberType["Peek"] = 1] = "Peek";
})(SubscriberType || (SubscriberType = {}));
class Queue {
    constructor(list) {
        this.privPromiseStore = new List_js_1.List();
        this.privIsDrainInProgress = false;
        this.privIsDisposing = false;
        this.privDisposeReason = null;
        this.privList = list ? list : new List_js_1.List();
        this.privDetachables = [];
        this.privSubscribers = new List_js_1.List();
        this.privDetachables.push(this.privList.onAdded(() => this.drain()));
    }
    enqueue(item) {
        this.throwIfDispose();
        this.enqueueFromPromise(new Promise((resolve) => resolve(item)));
    }
    enqueueFromPromise(promise) {
        this.throwIfDispose();
        promise.then((val) => {
            this.privList.add(val);
            // eslint-disable-next-line @typescript-eslint/no-empty-function
        }, () => { });
    }
    dequeue() {
        this.throwIfDispose();
        const deferredSubscriber = new Promise_js_1.Deferred();
        if (this.privSubscribers) {
            this.privSubscribers.add({ deferral: deferredSubscriber, type: SubscriberType.Dequeue });
            this.drain();
        }
        return deferredSubscriber.promise;
    }
    peek() {
        this.throwIfDispose();
        const deferredSubscriber = new Promise_js_1.Deferred();
        const subs = this.privSubscribers;
        if (subs) {
            this.privSubscribers.add({ deferral: deferredSubscriber, type: SubscriberType.Peek });
            this.drain();
        }
        return deferredSubscriber.promise;
    }
    length() {
        this.throwIfDispose();
        return this.privList.length();
    }
    isDisposed() {
        return this.privSubscribers == null;
    }
    async drainAndDispose(pendingItemProcessor, reason) {
        if (!this.isDisposed() && !this.privIsDisposing) {
            this.privDisposeReason = reason;
            this.privIsDisposing = true;
            const subs = this.privSubscribers;
            if (subs) {
                while (subs.length() > 0) {
                    const subscriber = subs.removeFirst();
                    // TODO: this needs work (Resolve(null) instead?).
                    subscriber.deferral.resolve(undefined);
                    // subscriber.deferral.reject("Disposed");
                }
                // note: this block assumes cooperative multitasking, i.e.,
                // between the if-statement and the assignment there are no
                // thread switches.
                // Reason is that between the initial const = this.; and this
                // point there is the derral.resolve() operation that might have
                // caused recursive calls to the Queue, especially, calling
                // Dispose() on the queue alredy (which would reset the var
                // here to null!).
                // That should generally hold true for javascript...
                if (this.privSubscribers === subs) {
                    this.privSubscribers = subs;
                }
            }
            for (const detachable of this.privDetachables) {
                await detachable.detach();
            }
            if (this.privPromiseStore.length() > 0 && pendingItemProcessor) {
                const promiseArray = [];
                this.privPromiseStore.toArray().forEach((wrapper) => {
                    promiseArray.push(wrapper);
                });
                return Promise.all(promiseArray).finally(() => {
                    this.privSubscribers = null;
                    this.privList.forEach((item) => {
                        pendingItemProcessor(item);
                    });
                    this.privList = null;
                    return;
                }).then();
            }
            else {
                this.privSubscribers = null;
                this.privList = null;
            }
        }
    }
    async dispose(reason) {
        await this.drainAndDispose(null, reason);
    }
    drain() {
        if (!this.privIsDrainInProgress && !this.privIsDisposing) {
            this.privIsDrainInProgress = true;
            const subs = this.privSubscribers;
            const lists = this.privList;
            if (subs && lists) {
                while (lists.length() > 0 && subs.length() > 0 && !this.privIsDisposing) {
                    const subscriber = subs.removeFirst();
                    if (subscriber.type === SubscriberType.Peek) {
                        subscriber.deferral.resolve(lists.first());
                    }
                    else {
                        const dequeuedItem = lists.removeFirst();
                        subscriber.deferral.resolve(dequeuedItem);
                    }
                }
                // note: this block assumes cooperative multitasking, i.e.,
                // between the if-statement and the assignment there are no
                // thread switches.
                // Reason is that between the initial const = this.; and this
                // point there is the derral.resolve() operation that might have
                // caused recursive calls to the Queue, especially, calling
                // Dispose() on the queue alredy (which would reset the var
                // here to null!).
                // That should generally hold true for javascript...
                if (this.privSubscribers === subs) {
                    this.privSubscribers = subs;
                }
                // note: this block assumes cooperative multitasking, i.e.,
                // between the if-statement and the assignment there are no
                // thread switches.
                // Reason is that between the initial const = this.; and this
                // point there is the derral.resolve() operation that might have
                // caused recursive calls to the Queue, especially, calling
                // Dispose() on the queue alredy (which would reset the var
                // here to null!).
                // That should generally hold true for javascript...
                if (this.privList === lists) {
                    this.privList = lists;
                }
            }
            this.privIsDrainInProgress = false;
        }
    }
    throwIfDispose() {
        if (this.isDisposed()) {
            if (this.privDisposeReason) {
                throw new Error_js_1.InvalidOperationError(this.privDisposeReason);
            }
            throw new Error_js_1.ObjectDisposedError("Queue");
        }
        else if (this.privIsDisposing) {
            throw new Error_js_1.InvalidOperationError("Queue disposing");
        }
    }
}
exports.Queue = Queue;

//# sourceMappingURL=Queue.js.map
