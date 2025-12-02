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
import { EventEmitter } from 'events';
import { Message, Subscriber } from './subscriber';
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
export declare const logs: {
    callbackDelivery: import("google-logging-utils").AdhocDebugLogFunction;
    callbackExceptions: import("google-logging-utils").AdhocDebugLogFunction;
    expiry: import("google-logging-utils").AdhocDebugLogFunction;
    subscriberFlowControl: import("google-logging-utils").AdhocDebugLogFunction;
};
export interface FlowControlOptions {
    allowExcessMessages?: boolean;
    maxBytes?: number;
    maxMessages?: number;
}
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
export declare class LeaseManager extends EventEmitter {
    bytes: number;
    private _isLeasing;
    private _messages;
    private _options;
    private _pending;
    private _subscriber;
    private _timer?;
    constructor(sub: Subscriber, options?: {});
    /**
     * @type {number}
     * @private
     */
    get pending(): number;
    /**
     * @type {number}
     * @private
     */
    get size(): number;
    /**
     * Adds a message to the inventory, kicking off the deadline extender if it
     * isn't already running.
     *
     * @param {Message} message The message.
     * @private
     */
    add(message: Message): void;
    /**
     * Removes ALL messages from inventory, and returns the ones removed.
     * @private
     */
    clear(): Message[];
    /**
     * Indicates if we're at or over capacity.
     *
     * @returns {boolean}
     * @private
     */
    isFull(): boolean;
    /**
     * True if we have no messages in leasing.
     *
     * @returns {boolean}
     * @private
     */
    isEmpty(): boolean;
    /**
     * Removes a message from the inventory. Stopping the deadline extender if no
     * messages are left over.
     *
     * @fires LeaseManager#free
     *
     * @param {Message} message The message to remove.
     * @private
     */
    remove(message: Message): void;
    /**
     * Sets options for the LeaseManager.
     *
     * @param {FlowControlOptions} [options] The options.
     *
     * @throws {RangeError} If both maxExtension and maxExtensionMinutes are set.
     *
     * @private
     */
    setOptions(options: FlowControlOptions): void;
    /**
     * Stops extending message deadlines.
     *
     * @private
     */
    private _cancelExtension;
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
    private _dispense;
    /**
     * Loops through inventory and extends the deadlines for any messages that
     * have not hit the max extension option.
     *
     * @private
     */
    private _extendDeadlines;
    /**
     * Creates a timeout(ms) that should allow us to extend any message deadlines
     * before they would be redelivered.
     *
     * @private
     *
     * @returns {number}
     */
    private _getNextExtensionTimeoutMs;
    /**
     * Schedules an deadline extension for all messages.
     *
     * @private
     */
    private _scheduleExtension;
}
