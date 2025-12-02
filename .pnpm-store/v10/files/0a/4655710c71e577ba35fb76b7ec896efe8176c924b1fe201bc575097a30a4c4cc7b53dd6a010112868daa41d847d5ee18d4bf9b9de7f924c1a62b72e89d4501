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
import { PreciseDate } from '@google-cloud/precise-date';
import { google } from '../protos/protos';
import { FlowControlOptions } from './lease-manager';
import { BatchOptions } from './message-queues';
import { MessageStreamOptions } from './message-stream';
import { Subscription } from './subscription';
import { SubscriberClient } from './v1';
import * as tracing from './telemetry-tracing';
import { Duration } from './temporal';
import { EventEmitter } from 'events';
export { StatusError } from './message-stream';
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
export declare const logs: {
    slowAck: import("google-logging-utils").AdhocDebugLogFunction;
    ackNack: import("google-logging-utils").AdhocDebugLogFunction;
    debug: import("google-logging-utils").AdhocDebugLogFunction;
};
export type PullResponse = google.pubsub.v1.IStreamingPullResponse;
export type SubscriptionProperties = google.pubsub.v1.StreamingPullResponse.ISubscriptionProperties;
type ValueOf<T> = T[keyof T];
export declare const AckResponses: {
    PermissionDenied: "PERMISSION_DENIED";
    FailedPrecondition: "FAILED_PRECONDITION";
    Success: "SUCCESS";
    Invalid: "INVALID";
    Other: "OTHER";
};
export type AckResponse = ValueOf<typeof AckResponses>;
/**
 * Enum values for behaviors of the Subscriber.close() method.
 */
export declare const SubscriberCloseBehaviors: {
    NackImmediately: "NACK";
    WaitForProcessing: "WAIT";
};
export type SubscriberCloseBehavior = ValueOf<typeof SubscriberCloseBehaviors>;
/**
 * Options to modify the behavior of the Subscriber.close() method. If
 * none is passed, the default is SubscriberCloseBehaviors.Wait.
 */
export interface SubscriberCloseOptions {
    behavior?: SubscriberCloseBehavior;
    timeout?: Duration;
}
/**
 * Thrown when an error is detected in an ack/nack/modack call, when
 * exactly-once delivery is enabled on the subscription. This will
 * only be thrown for actual errors that can't be retried.
 */
export declare class AckError extends Error {
    errorCode: AckResponse;
    constructor(errorCode: AckResponse, message?: string);
}
/**
 * Tracks the various spans related to subscriber/receive tracing.
 *
 * @private
 */
export declare class SubscriberSpans {
    parent: tracing.MessageWithAttributes;
    constructor(parent: tracing.MessageWithAttributes);
    flowStart(): void;
    flowEnd(): void;
    ackStart(): void;
    ackEnd(): void;
    ackCall(): void;
    nackStart(): void;
    nackEnd(): void;
    nackCall(): void;
    modAckStart(deadline: Duration, isInitial: boolean): void;
    modAckEnd(): void;
    modAckCall(deadline: Duration): void;
    schedulerStart(): void;
    schedulerEnd(): void;
    processingStart(subName: string): void;
    processingEnd(): void;
    shutdown(): void;
    private flow?;
    private scheduler?;
    private processing?;
}
/**
 * Date object with nanosecond precision. Supports all standard Date arguments
 * in addition to several custom types.
 *
 * @external PreciseDate
 * @see {@link https://github.com/googleapis/nodejs-precise-date|PreciseDate}
 */
/**
 * Message objects provide a simple interface for users to get message data and
 * acknowledge the message.
 *
 * @example
 * ```
 * subscription.on('message', message => {
 *   // {
 *   //   ackId: 'RUFeQBJMJAxESVMrQwsqWBFOBCEhPjA',
 *   //   attributes: {key: 'value'},
 *   //   data: Buffer.from('Hello, world!'),
 *   //   id: '1551297743043',
 *   //   orderingKey: 'ordering-key',
 *   //   publishTime: new PreciseDate('2019-02-27T20:02:19.029534186Z'),
 *   //   received: 1551297743043,
 *   //   length: 13
 *   // }
 * });
 * ```
 */
export declare class Message implements tracing.MessageWithAttributes {
    ackId: string;
    attributes: {
        [key: string]: string;
    };
    data: Buffer;
    deliveryAttempt: number;
    id: string;
    orderingKey?: string;
    publishTime: PreciseDate;
    received: number;
    private _handledPromise;
    private _handled;
    private _length;
    private _subscriber;
    private _ackFailed?;
    private _dispatched;
    /**
     * @private
     *
     * Tracks a telemetry tracing parent span through the receive process. This will
     * be the original publisher-side span if we have one; otherwise we'll create
     * a "publisher" span to hang new subscriber spans onto.
     *
     * This needs to be declared explicitly here, because having a public class
     * implement a private interface seems to confuse TypeScript. (And it's needed
     * in unit tests.)
     */
    parentSpan?: tracing.Span;
    /**
     * @private
     *
     * Ends any open subscribe telemetry tracing span.
     */
    endParentSpan(): void;
    /**
     * @private
     *
     * Tracks subscriber-specific telemetry objects through the library.
     */
    subSpans: SubscriberSpans;
    /**
     * @hideconstructor
     *
     * @param {Subscriber} sub The parent subscriber.
     * @param {object} message The raw message response.
     */
    constructor(sub: Subscriber, { ackId, message, deliveryAttempt }: google.pubsub.v1.IReceivedMessage);
    /**
     * The length of the message data.
     *
     * @type {number}
     */
    get length(): number;
    /**
     * Resolves when the message has been handled fully; a handled message may
     * not have any further operations performed on it.
     *
     * @private
     */
    get handledPromise(): Promise<void>;
    /**
     * When this message is dispensed to user callback code, this should be called.
     * The time between the dispatch and the handledPromise resolving is when the
     * message is with the user.
     *
     * @private
     */
    dispatched(): void;
    /**
     * @private
     * @returns True if this message has been dispatched to user callback code.
     */
    isDispatched(): boolean;
    /**
     * Sets this message's exactly once delivery acks to permanent failure. This is
     * meant for internal library use only.
     *
     * @private
     */
    ackFailed(error: AckError): void;
    /**
     * Acknowledges the message.
     *
     * @example
     * ```
     * subscription.on('message', message => {
     *   message.ack();
     * });
     * ```
     */
    ack(): void;
    /**
     * Acknowledges the message, expecting a response (for exactly-once delivery subscriptions).
     * If exactly-once delivery is not enabled, this will immediately resolve successfully.
     *
     * @example
     * ```
     * subscription.on('message', async (message) => {
     *   const response = await message.ackWithResponse();
     * });
     * ```
     */
    ackWithResponse(): Promise<AckResponse>;
    /**
     * Modifies the ack deadline.
     * At present time, this should generally not be called by users.
     *
     * @param {number} deadline The number of seconds to extend the deadline.
     * @private
     */
    modAck(deadline: number): void;
    /**
     * Modifies the ack deadline, expecting a response (for exactly-once delivery subscriptions).
     * If exactly-once delivery is not enabled, this will immediately resolve successfully.
     * At present time, this should generally not be called by users.
     *
     * @param {number} deadline The number of seconds to extend the deadline.
     * @private
     */
    modAckWithResponse(deadline: number): Promise<AckResponse>;
    /**
     * Removes the message from our inventory and schedules it to be redelivered.
     *
     * @example
     * ```
     * subscription.on('message', message => {
     *   message.nack();
     * });
     * ```
     */
    nack(): void;
    /**
     * Removes the message from our inventory and schedules it to be redelivered,
     * with the modAck response being returned (for exactly-once delivery subscriptions).
     * If exactly-once delivery is not enabled, this will immediately resolve successfully.
     *
     * @example
     * ```
     * subscription.on('message', async (message) => {
     *   const response = await message.nackWithResponse();
     * });
     * ```
     */
    nackWithResponse(): Promise<AckResponse>;
}
/**
 * @typedef {object} SubscriberOptions
 * @property {number} [ackDeadline=10] Acknowledge deadline in seconds. If left
 *     unset, the initial value will be 10 seconds, but it will evolve into the
 *     99th percentile time it takes to acknowledge a message, subject to the
 *     limitations of minAckDeadline and maxAckDeadline. If ackDeadline is set
 *     by the user, then the min/max values will be set to match it. New code
 *     should prefer setting minAckDeadline and maxAckDeadline directly.
 * @property {Duration} [minAckDeadline] The minimum time that ackDeadline should
 *     ever have, while it's under library control.
 * @property {Duration} [maxAckDeadline] The maximum time that ackDeadline should
 *     ever have, while it's under library control.
 * @property {Duration} [maxExtensionTime] The maximum time that ackDeadline should
 *     ever have, while it's under library control.
 * @property {BatchOptions} [batching] Request batching options; this is for
 *     batching acks and modacks being sent back to the server.
 * @property {FlowControlOptions} [flowControl] Flow control options.
 * @property {boolean} [useLegacyFlowControl] Disables enforcing flow control
 *     settings at the Cloud PubSub server and uses the less accurate method
 *     of only enforcing flow control at the client side.
 * @property {MessageStreamOptions} [streamingOptions] Streaming options.
 *     If no options are passed, it behaves like `SubscriberCloseBehaviors.Wait`.
 * @property {SubscriberCloseOptions} [options] Determines the basic behavior of the
 *     close() function.
 * @property {SubscriberCloseBehavior} [options.behavior] The behavior of the close operation.
 *     - NackImmediately: Sends nacks for all messages held by the client library, and
 *       wait for them to send.
 *     - WaitForProcessing: Continues normal ack/nack and leasing processes until close
 *       to the timeout, then switches to NackImmediately behavior to close down.
 *     Use {@link SubscriberCloseBehaviors} for enum values.
 * @property {Duration} [options.timeout] In the case of Timeout, the maximum duration
 *     to wait for pending ack/nack requests to complete before resolving (or rejecting)
 *     the promise.
 */
export interface SubscriberOptions {
    minAckDeadline?: Duration;
    maxAckDeadline?: Duration;
    maxExtensionTime?: Duration;
    batching?: BatchOptions;
    flowControl?: FlowControlOptions;
    useLegacyFlowControl?: boolean;
    streamingOptions?: MessageStreamOptions;
    closeOptions?: SubscriberCloseOptions;
}
/**
 * Subscriber class is used to manage all message related functionality.
 *
 * @private
 * @class
 *
 * @param {Subscription} subscription The corresponding subscription.
 * @param {SubscriberOptions} options The subscriber options.
 */
export declare class Subscriber extends EventEmitter {
    #private;
    ackDeadline: number;
    maxMessages: number;
    maxBytes: number;
    useLegacyFlowControl: boolean;
    isOpen: boolean;
    maxExtensionTime: Duration;
    private _acks;
    private _histogram;
    private _inventory;
    private _latencies;
    private _modAcks;
    private _name;
    private _options;
    private _stream;
    private _subscription;
    private _99th;
    subscriptionProperties?: SubscriptionProperties;
    constructor(subscription: Subscription, options?: {});
    /**
     * Update our ack extension time that will be used by the lease manager
     * for sending modAcks.
     *
     * Should not be called from outside this class, except for unit tests.
     *
     * @param {number} [ackTimeSeconds] The number of seconds that the last
     *   ack took after the message was received. If this is undefined, then
     *   we won't update the histogram, but we will still recalculate the
     *   ackDeadline based on the situation.
     *
     * @private
     */
    updateAckDeadline(ackTimeSeconds?: number): void;
    private getMinMaxDeadlines;
    /**
     * Returns true if an exactly-once delivery subscription has been detected.
     *
     * @private
     */
    get isExactlyOnceDelivery(): boolean;
    /**
     * Sets our subscription properties from incoming messages.
     *
     * @param {SubscriptionProperties} subscriptionProperties The new properties.
     * @private
     */
    setSubscriptionProperties(subscriptionProperties: SubscriptionProperties): void;
    /**
     * The 99th percentile of request latencies.
     *
     * @type {number}
     * @private
     */
    get modAckLatency(): number;
    /**
     * The full name of the Subscription.
     *
     * @type {string}
     * @private
     */
    get name(): string;
    /**
     * Acknowledges the supplied message.
     *
     * @param {Message} message The message to acknowledge.
     * @returns {Promise<void>}
     * @private
     */
    ack(message: Message): Promise<void>;
    /**
     * Acknowledges the supplied message, expecting a response (for exactly
     * once subscriptions).
     *
     * @param {Message} message The message to acknowledge.
     * @returns {Promise<AckResponse>}
     * @private
     */
    ackWithResponse(message: Message): Promise<AckResponse>;
    /**
     * Closes the subscriber, stopping the reception of new messages and shutting
     * down the underlying stream. The behavior of the returned Promise will depend
     * on the closeOptions in the subscriber options.
     *
     * @returns {Promise<void>} A promise that resolves when the subscriber is closed
     *   and pending operations are flushed or the timeout is reached.
     *
     * @private
     */
    close(): Promise<void>;
    /**
     * Gets the subscriber client instance.
     *
     * @returns {Promise<object>}
     * @private
     */
    getClient(): Promise<SubscriberClient>;
    /**
     * Modifies the acknowledge deadline for the provided message.
     *
     * @param {Message} message The message to modify.
     * @param {number} deadline The deadline in seconds.
     * @returns {Promise<void>}
     * @private
     */
    modAck(message: Message, deadline: number): Promise<void>;
    /**
     * Modifies the acknowledge deadline for the provided message, expecting
     * a reply (for exactly-once delivery subscriptions).
     *
     * @param {Message} message The message to modify.
     * @param {number} deadline The deadline.
     * @returns {Promise<AckResponse>}
     * @private
     */
    modAckWithResponse(message: Message, deadline: number): Promise<AckResponse>;
    /**
     * Modfies the acknowledge deadline for the provided message and then removes
     * it from our inventory.
     *
     * @param {Message} message The message.
     * @return {Promise<void>}
     * @private
     */
    nack(message: Message): Promise<void>;
    /**
     * Modfies the acknowledge deadline for the provided message and then removes
     * it from our inventory, expecting a response from modAck (for
     * exactly-once delivery subscriptions).
     *
     * @param {Message} message The message.
     * @return {Promise<AckResponse>}
     * @private
     */
    nackWithResponse(message: Message): Promise<AckResponse>;
    /**
     * Starts pulling messages.
     * @private
     */
    open(): void;
    /**
     * Sets subscriber options.
     *
     * @param {SubscriberOptions} options The options.
     * @private
     */
    setOptions(options: SubscriberOptions): void;
    /**
     * Retrieves our effective options. This is mostly for unit test use.
     *
     * @private
     * @returns {SubscriberOptions} The options.
     */
    getOptions(): SubscriberOptions;
    /**
     * Constructs a telemetry span from the incoming message.
     *
     * @param {Message} message One of the received messages
     * @private
     */
    private createParentSpan;
    /**
     * Callback to be invoked when a new message is available.
     *
     * New messages will be added to the subscribers inventory, which in turn will
     * automatically extend the messages ack deadline until either:
     *   a. the user acks/nacks it
     *   b. the maxExtension option is hit
     *
     * If the message puts us at/over capacity, then we'll pause our message
     * stream until we've freed up some inventory space.
     *
     * New messages must immediately issue a ModifyAckDeadline request
     * (aka receipt) to confirm with the backend that we did infact receive the
     * message and its ok to start ticking down on the deadline.
     *
     * @private
     */
    private _onData;
    private _discardMessage;
    /**
     * Returns a promise that will resolve once all pending requests have settled.
     *
     * @private
     *
     * @returns {Promise<void>}
     */
    private _waitForFlush;
}
