"use strict";
/*!
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowControl = void 0;
const defer = require("p-defer");
/**
 * Manages flow control handling for max bytes and messages.
 *
 * Do not use this class externally, it may change without warning.
 * @private
 *
 */
class FlowControl {
    options = {};
    bytes;
    messages;
    requests;
    constructor(options) {
        this.setOptions(options);
        this.bytes = this.messages = 0;
        this.requests = [];
    }
    /**
     * Update our options after the fact.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    setOptions(options) {
        this.options = options;
        if (this.options.maxOutstandingBytes === 0 ||
            this.options.maxOutstandingMessages === 0) {
            // Undefined is okay, but if either is zero, no publishes ever happen.
            throw new Error('When using publisher flow control, maxOutstandingBytes and maxOutstandingMessages must not be zero');
        }
    }
    /**
     * @returns {number} The number of bytes that are queued up.
     */
    get currentByteCount() {
        return this.bytes;
    }
    /**
     * @returns {number} The number of messages that are queued up.
     */
    get currentMessageCount() {
        return this.messages;
    }
    /**
     * Adds the specified number of bytes or messages to our count. We'll
     * assume that this is end running around our queueing mechanisms.
     *
     * @param {number} bytes The number of bytes to add to the count.
     * @param {number} messages The number of messages to add to the count.
     */
    addToCount(bytes, messages) {
        this.bytes += bytes;
        this.messages += messages;
    }
    /**
     * Attempts to queue the specified number of bytes and messages. If
     * there are too many things in the publisher flow control queue
     * already, we will defer and come back to it.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    async willSend(bytes, messages) {
        // Add this to our queue size.
        this.bytes += bytes;
        this.messages += messages;
        // If this request won't fit, we have to put it in the queue.
        if (this.exceeded()) {
            const promise = defer();
            this.requests.push({
                promise: promise.promise,
                resolve: promise.resolve,
                reject: promise.reject,
                bytes,
                messageCount: messages,
            });
            // This will pass through when someone else's this.sent() completes.
            await promise.promise;
        }
    }
    /**
     * Removes the specified number of bytes and messages from our queued
     * counts, after a deferred request was released. If there is enough
     * space.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    sent(bytes, messages) {
        this.bytes -= bytes;
        this.messages -= messages;
        // This shouldn't happen, but just be sure.
        if (this.bytes < 0)
            this.bytes = 0;
        if (this.messages < 0)
            this.messages = 0;
        // Let things waiting on willSend() have a go, if there's space.
        if (this.requests.length > 0 && !this.exceeded()) {
            const next = this.requests.shift();
            next.resolve();
        }
    }
    // Just uses wouldExceed() to see if we've already exceeded the limits.
    exceeded() {
        return this.wouldExceed(0, 0);
    }
    /**
     * Returns true if adding the specified number of bytes or messages
     * would exceed limits imposed by configuration.
     *
     * Do not use externally, it may change without warning.
     * @private
     */
    wouldExceed(bytes, messages) {
        const totalBytes = this.bytes + bytes;
        const totalMessages = this.messages + messages;
        if (this.options.maxOutstandingBytes !== undefined &&
            totalBytes > this.options.maxOutstandingBytes) {
            return true;
        }
        if (this.options.maxOutstandingMessages !== undefined &&
            totalMessages > this.options.maxOutstandingMessages) {
            return true;
        }
        return false;
    }
}
exports.FlowControl = FlowControl;
//# sourceMappingURL=flow-control.js.map