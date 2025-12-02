"use strict";
// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExponentialRetry = void 0;
const heap_js_1 = require("heap-js");
const temporal_1 = require("./temporal");
// Compare function for Heap so we can use it as a priority queue.
function comparator(a, b) {
    return a.retryInfo.nextRetry - b.retryInfo.nextRetry;
}
/**
 * Provides a helper that will manage your retries using the "truncated
 * exponential backoff" strategy.
 *
 * Most of the pieces of this library are doing retries via gax, but for
 * exactly-once delivery, we have some things where gRPC failures won't
 * take care of it.
 *
 * @private
 */
class ExponentialRetry {
    _items = new heap_js_1.default((comparator));
    _backoffMs;
    _maxBackoffMs;
    _timer;
    constructor(backoff, maxBackoff) {
        this._backoffMs = backoff.milliseconds;
        this._maxBackoffMs = maxBackoff.milliseconds;
    }
    /**
     * Shut down all operations/timers/etc and return a list of
     * items that were still pending retry.
     *
     * @private
     */
    close() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
        const leftovers = this._items.toArray();
        this._items.clear();
        return leftovers;
    }
    /**
     * Place an item on the retry queue. It's important that it's the
     * same exact item that was already on the queue, if it's being retried
     * more than once.
     *
     * @private
     */
    retryLater(item, callback) {
        const retried = item;
        const retryInfo = retried.retryInfo;
        if (!retryInfo) {
            // This item's first time through.
            retried.retryInfo = {
                firstRetry: Date.now(),
                nextRetry: Date.now() + this.randomizeDelta(this._backoffMs),
                multiplier: 1,
                callback,
            };
        }
        else {
            // Not the first time - handle backoff.
            const nextMultiplier = retryInfo.multiplier * 2;
            let delta = this.randomizeDelta(nextMultiplier * this._backoffMs);
            if (delta > this._maxBackoffMs) {
                delta = this.randomizeDelta(this._maxBackoffMs);
            }
            else {
                retryInfo.multiplier = nextMultiplier;
            }
            retryInfo.nextRetry = Date.now() + delta;
        }
        // Re-sort it into the heap with the correct position.
        // It's my assumption here that any item that is being retried is
        // very likely near or at the top.
        this._items.remove(retried);
        this._items.push(retried);
        // Schedule the next retry.
        this.scheduleRetry();
    }
    /**
     * Resets an item that was previously retried. This is useful if you have
     * persistent items that just need to be retried occasionally.
     *
     * @private
     */
    reset(item) {
        const retried = item;
        delete retried.retryInfo;
    }
    // Takes a time delta and adds fuzz.
    randomizeDelta(durationMs) {
        // The fuzz distance should never exceed one second, but in the
        // case of smaller things, don't end up with a negative delta.
        const magnitude = durationMs < 1000 ? durationMs : 1000;
        const offset = Math.random() * magnitude - magnitude / 2.0;
        return durationMs + offset;
    }
    // Looks through the queue to see if there's anything to handle.
    doRetries() {
        const now = Date.now();
        while (!this._items.isEmpty()) {
            const next = this._items.peek();
            // Within 10msec is close enough.
            if (next.retryInfo.nextRetry - now < 10) {
                this._items.pop();
                next.retryInfo.callback(next, temporal_1.Duration.from({ milliseconds: now - next.retryInfo.firstRetry }));
            }
            else {
                break;
            }
        }
        // Is there stuff to retry still?
        if (!this._items.isEmpty()) {
            this.scheduleRetry();
        }
    }
    // If there are items to retry, schedule the next timer event.
    scheduleRetry() {
        // What's next?
        const next = this._items.peek();
        if (next) {
            let delta = next.retryInfo.nextRetry - Date.now();
            if (delta < 0) {
                delta = 0;
            }
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(() => {
                this.doRetries();
            }, delta);
        }
    }
}
exports.ExponentialRetry = ExponentialRetry;
//# sourceMappingURL=exponential-retry.js.map