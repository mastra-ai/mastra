"use strict";
/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
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
exports.LeaseManager = exports.logs = void 0;
const events_1 = require("events");
const default_options_1 = require("./default-options");
const temporal_1 = require("./temporal");
const debug_1 = require("./debug");
const logs_1 = require("./logs");
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
exports.logs = {
    callbackDelivery: logs_1.logs.pubsub.sublog('callback-delivery'),
    callbackExceptions: logs_1.logs.pubsub.sublog('callback-exceptions'),
    expiry: logs_1.logs.pubsub.sublog('expiry'),
    subscriberFlowControl: logs_1.logs.pubsub.sublog('subscriber-flow-control'),
};
/**
 * @typedef {object} FlowControlOptions
 * @property {boolean} [allowExcessMessages=true] PubSub delivers messages in
 *     batches with no way to configure the batch size. Sometimes this can be
 *     overwhelming if you only want to process a few messages at a time.
 *     Setting this option to false will make the client manage any excess
 *     messages until you're ready for them. This will prevent them from being
 *     redelivered and make the maxMessages option behave more predictably.
 * @property {number} [maxBytes=104857600] The desired amount of memory to
 *     allow message data to consume. (Default: 100MB) It's possible that this
 *     value will be exceeded, since messages are received in batches.
 * @property {number} [maxExtensionMinutes=60] The maximum duration (in minutes)
 *     to extend the message deadline before redelivering.
 * @property {number} [maxMessages=1000] The desired number of messages to allow
 *     in memory before pausing the message stream. Unless allowExcessMessages
 *     is set to false, it is very likely that this value will be exceeded since
 *     any given message batch could contain a greater number of messages than
 *     the desired amount of messages.
 */
/**
 * Manages a Subscribers inventory while auto-magically extending the message
 * deadlines.
 *
 * @private
 * @class
 *
 * @param {Subscriber} sub The subscriber to manage leases for.
 * @param {FlowControlOptions} options Flow control options.
 */
class LeaseManager extends events_1.EventEmitter {
    bytes;
    _isLeasing;
    _messages;
    _options;
    _pending;
    _subscriber;
    _timer;
    constructor(sub, options = {}) {
        super();
        this.bytes = 0;
        this._isLeasing = false;
        this._messages = new Set();
        this._pending = [];
        this._subscriber = sub;
        this.setOptions(options);
    }
    /**
     * @type {number}
     * @private
     */
    get pending() {
        return this._pending.length;
    }
    /**
     * @type {number}
     * @private
     */
    get size() {
        return this._messages.size;
    }
    /**
     * Adds a message to the inventory, kicking off the deadline extender if it
     * isn't already running.
     *
     * @param {Message} message The message.
     * @private
     */
    add(message) {
        const { allowExcessMessages } = this._options;
        const wasFull = this.isFull();
        this._messages.add(message);
        this.bytes += message.length;
        message.subSpans.flowStart();
        if (allowExcessMessages || !wasFull) {
            this._dispense(message);
        }
        else {
            if (this.pending === 0) {
                exports.logs.subscriberFlowControl.info('subscriber for %s is client-side flow blocked', this._subscriber.name);
            }
            this._pending.push(message);
        }
        if (!this._isLeasing) {
            this._isLeasing = true;
            this._scheduleExtension();
        }
        if (!wasFull && this.isFull()) {
            this.emit('full');
        }
    }
    /**
     * Removes ALL messages from inventory, and returns the ones removed.
     * @private
     */
    clear() {
        const wasFull = this.isFull();
        const wasEmpty = this.isEmpty();
        if (this.pending > 0) {
            exports.logs.subscriberFlowControl.info('subscriber for %s is unblocking client-side flow due to clear()', this._subscriber.name);
        }
        this._pending = [];
        const remaining = Array.from(this._messages);
        this._messages.clear();
        this.bytes = 0;
        if (wasFull) {
            process.nextTick(() => this.emit('free'));
        }
        if (!wasEmpty && this.isEmpty()) {
            process.nextTick(() => this.emit('empty'));
        }
        this._cancelExtension();
        return remaining;
    }
    /**
     * Indicates if we're at or over capacity.
     *
     * @returns {boolean}
     * @private
     */
    isFull() {
        const { maxBytes, maxMessages } = this._options;
        return this.size >= maxMessages || this.bytes >= maxBytes;
    }
    /**
     * True if we have no messages in leasing.
     *
     * @returns {boolean}
     * @private
     */
    isEmpty() {
        return this._messages.size === 0;
    }
    /**
     * Removes a message from the inventory. Stopping the deadline extender if no
     * messages are left over.
     *
     * @fires LeaseManager#free
     *
     * @param {Message} message The message to remove.
     * @private
     */
    remove(message) {
        if (!this._messages.has(message)) {
            return;
        }
        const wasFull = this.isFull();
        this._messages.delete(message);
        this.bytes -= message.length;
        if (wasFull && !this.isFull()) {
            process.nextTick(() => this.emit('free'));
        }
        else if (this._pending.includes(message)) {
            const index = this._pending.indexOf(message);
            this._pending.splice(index, 1);
        }
        else if (this.pending > 0) {
            if (this.pending > 1) {
                exports.logs.subscriberFlowControl.info('subscriber for %s dispensing one blocked message', this._subscriber.name);
            }
            else {
                exports.logs.subscriberFlowControl.info('subscriber for %s fully unblocked on client-side flow control', this._subscriber.name);
            }
            this._dispense(this._pending.shift());
        }
        if (this.isEmpty()) {
            this.emit('empty');
        }
        if (this.size === 0 && this._isLeasing) {
            this._cancelExtension();
        }
    }
    /**
     * Sets options for the LeaseManager.
     *
     * @param {FlowControlOptions} [options] The options.
     *
     * @throws {RangeError} If both maxExtension and maxExtensionMinutes are set.
     *
     * @private
     */
    setOptions(options) {
        const defaults = {
            allowExcessMessages: true,
            maxBytes: default_options_1.defaultOptions.subscription.maxOutstandingBytes,
            maxMessages: default_options_1.defaultOptions.subscription.maxOutstandingMessages,
        };
        this._options = Object.assign(defaults, options);
    }
    /**
     * Stops extending message deadlines.
     *
     * @private
     */
    _cancelExtension() {
        this._isLeasing = false;
        if (this._timer) {
            clearTimeout(this._timer);
            delete this._timer;
        }
    }
    /**
     * Emits the message. Emitting messages is very slow, so to avoid it acting
     * as a bottleneck, we're wrapping it in nextTick.
     *
     * @private
     *
     * @fires Subscriber#message
     *
     * @param {Message} message The message to emit.
     */
    _dispense(message) {
        if (this._subscriber.isOpen) {
            message.subSpans.flowEnd();
            process.nextTick(() => {
                message.dispatched();
                exports.logs.callbackDelivery.info('message (ID %s, ackID %s) delivery to user callbacks', message.id, message.ackId);
                message.subSpans.processingStart(this._subscriber.name);
                try {
                    this._subscriber.emit('message', message);
                }
                catch (e) {
                    exports.logs.callbackExceptions.error('message (ID %s, ackID %s) caused a user callback exception: %o', message.id, message.ackId, e);
                    this._subscriber.emit('debug', new debug_1.DebugMessage('error during user callback', e));
                }
            });
        }
    }
    /**
     * Loops through inventory and extends the deadlines for any messages that
     * have not hit the max extension option.
     *
     * @private
     */
    _extendDeadlines() {
        const deadline = temporal_1.Duration.from({ seconds: this._subscriber.ackDeadline });
        const maxExtensionMinutes = this._subscriber.maxExtensionTime.totalOf('minute');
        for (const message of this._messages) {
            // Lifespan here is in minutes.
            const lifespan = (Date.now() - message.received) / (60 * 1000);
            if (lifespan < maxExtensionMinutes) {
                message.subSpans.modAckStart(deadline, false);
                if (this._subscriber.isExactlyOnceDelivery) {
                    message
                        .modAckWithResponse(deadline.totalOf('second'))
                        .catch(e => {
                        // In the case of a permanent failure (temporary failures are retried),
                        // we need to stop trying to lease-manage the message.
                        message.ackFailed(e);
                        this.remove(message);
                    })
                        .finally(() => {
                        message.subSpans.modAckEnd();
                    });
                }
                else {
                    message.modAck(deadline.totalOf('second'));
                    message.subSpans.modAckStart(deadline, false);
                }
            }
            else {
                exports.logs.expiry.warn('message (ID %s, ackID %s) has been dropped from leasing due to a timeout', message.id, message.ackId);
                this.remove(message);
            }
        }
        if (this._isLeasing) {
            this._scheduleExtension();
        }
    }
    /**
     * Creates a timeout(ms) that should allow us to extend any message deadlines
     * before they would be redelivered.
     *
     * @private
     *
     * @returns {number}
     */
    _getNextExtensionTimeoutMs() {
        const jitter = Math.random();
        const deadline = this._subscriber.ackDeadline * 1000;
        const latency = this._subscriber.modAckLatency;
        return (deadline * 0.9 - latency) * jitter;
    }
    /**
     * Schedules an deadline extension for all messages.
     *
     * @private
     */
    _scheduleExtension() {
        const timeout = this._getNextExtensionTimeoutMs();
        this._timer = setTimeout(() => this._extendDeadlines(), timeout);
    }
}
exports.LeaseManager = LeaseManager;
//# sourceMappingURL=lease-manager.js.map