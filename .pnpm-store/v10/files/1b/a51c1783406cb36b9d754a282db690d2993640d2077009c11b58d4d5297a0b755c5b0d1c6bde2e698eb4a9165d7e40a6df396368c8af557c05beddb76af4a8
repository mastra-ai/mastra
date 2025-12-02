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
import { CallOptions, GoogleError, grpc } from 'google-gax';
import defer = require('p-defer');
import { ExponentialRetry } from './exponential-retry';
import { AckResponse, Message, Subscriber } from './subscriber';
import { DebugMessage } from './debug';
import * as tracing from './telemetry-tracing';
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
export declare const logs: {
    ackBatch: import("google-logging-utils").AdhocDebugLogFunction;
};
export interface ReducedMessage {
    ackId: string;
    tracingSpan?: tracing.Span;
}
/**
 * @private
 */
export interface QueuedMessage {
    message: ReducedMessage;
    deadline?: number;
    responsePromise?: defer.DeferredPromise<void>;
    retryCount: number;
}
/**
 * @private
 */
export type QueuedMessages = Array<QueuedMessage>;
/**
 * Batching options for sending acks and modacks back to the server.
 */
export interface BatchOptions {
    callOptions?: CallOptions;
    maxMessages?: number;
    maxMilliseconds?: number;
}
export declare const MAX_BATCH_BYTES: number;
/**
 * Error class used to signal a batch failure.
 *
 * Now that we have exactly-once delivery subscriptions, we'll only
 * throw one of these if there was an unknown error.
 *
 * @class
 *
 * @param {string} message The error message.
 * @param {GoogleError} err The grpc error.
 */
export declare class BatchError extends DebugMessage {
    ackIds: string[];
    code: grpc.status;
    details: string;
    constructor(err: GoogleError, ackIds: string[], rpc: string);
}
/**
 * @typedef {object} BatchOptions
 * @property {object} [callOptions] Request configuration option, outlined
 *     here: {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html}.
 * @property {number} [maxMessages=3000] Maximum number of messages allowed in
 *     each batch sent.
 * @property {number} [maxMilliseconds=100] Maximum duration to wait before
 *     sending a batch. Batches can be sent earlier if the maxMessages option
 *     is met before the configured duration has passed.
 */
/**
 * Class for buffering ack/modAck requests.
 *
 * @private
 * @class
 *
 * @param {Subscriber} sub The subscriber we're queueing requests for.
 * @param {BatchOptions} options Batching options.
 */
export declare abstract class MessageQueue {
    numPendingRequests: number;
    numInFlightRequests: number;
    numInRetryRequests: number;
    bytes: number;
    protected _onFlush?: defer.DeferredPromise<void>;
    protected _onDrain?: defer.DeferredPromise<void>;
    protected _options: BatchOptions;
    protected _requests: QueuedMessages;
    protected _subscriber: Subscriber;
    protected _timer?: NodeJS.Timeout;
    protected _retrier: ExponentialRetry<QueuedMessage>;
    protected _closed: boolean;
    protected abstract _sendBatch(batch: QueuedMessages): Promise<QueuedMessages>;
    constructor(sub: Subscriber, options?: BatchOptions);
    protected abstract getType(): string;
    /**
     * Shuts down this message queue gracefully. Any acks/modAcks pending in
     * the queue or waiting for retry will be removed. If exactly-once delivery
     * is enabled on the subscription, we'll send permanent failures to
     * anyone waiting on completions; otherwise we'll send successes.
     *
     * If a flush is desired first, do it before calling close().
     *
     * @private
     */
    close(): void;
    /**
     * Gets the default buffer time in ms.
     *
     * @returns {number}
     * @private
     */
    get maxMilliseconds(): number;
    /*!
     * Logs about a batch being sent, and why.
     * @private
     */
    private logBatch;
    /**
     * Adds a message to the queue.
     *
     * @param {Message} message The message to add.
     * @param {number} [deadline] The deadline in seconds.
     * @private
     */
    add(message: Message, deadline?: number): Promise<void>;
    /**
     * Retry handler for acks/modacks that have transient failures. Unless
     * it's passed the final deadline, we will just re-queue it for sending.
     *
     * @private
     */
    private handleRetry;
    /**
     * This hook lets a subclass tell the retry handler to go ahead and fail early.
     *
     * @private
     */
    protected shouldFailEarly(message: QueuedMessage): boolean;
    /**
     * Sends a batch of messages.
     * @private
     */
    flush(reason?: string): Promise<void>;
    /**
     * Returns a promise that resolves after the next flush occurs.
     *
     * @returns {Promise}
     * @private
     */
    onFlush(): Promise<void>;
    /**
     * Returns a promise that resolves when all in-flight messages have settled.
     */
    onDrain(): Promise<void>;
    /**
     * Set the batching options.
     *
     * @param {BatchOptions} options Batching options.
     * @private
     */
    setOptions(options: BatchOptions): void;
    /**
     * Succeed a whole batch of Acks/Modacks for an OK RPC response.
     *
     * @private
     */
    handleAckSuccesses(batch: QueuedMessages): void;
    /**
     * If we get an RPC failure of any kind, this will take care of deciding
     * what to do for each related ack/modAck. Successful ones will have their
     * Promises resolved, permanent errors will have their Promises rejected,
     * and transients will be returned for retry.
     *
     * Note that this is only used for subscriptions with exactly-once
     * delivery enabled, so _sendBatch() in the classes below take care of
     * resolving errors to success; they don't make it here.
     *
     * @private
     */
    handleAckFailures(operation: string, batch: QueuedMessages, rpcError: GoogleError): {
        toError: Map<AckResponse, QueuedMessages>;
        toRetry: QueuedMessages;
    };
    /**
     * Since we handle our own retries for ack/modAck calls when exactly-once
     * delivery is enabled on a subscription, we conditionally need to disable
     * the gax retries. This returns an appropriate CallOptions for the
     * subclasses to pass down.
     *
     * @private
     */
    protected getCallOptions(): CallOptions | undefined;
}
/**
 * Queues up Acknowledge (ack) requests.
 *
 * @private
 * @class
 */
export declare class AckQueue extends MessageQueue {
    /**
     * @private
     * @returns The name of the items in this queue.
     */
    protected getType(): string;
    /**
     * Sends a batch of ack requests.
     *
     * @private
     *
     * @param {Array.<Array.<string|number>>} batch Array of ackIds and deadlines.
     * @return {Promise}
     */
    protected _sendBatch(batch: QueuedMessages): Promise<QueuedMessages>;
}
/**
 * Queues up ModifyAckDeadline requests and sends them out in batches.
 *
 * @private
 * @class
 */
export declare class ModAckQueue extends MessageQueue {
    /**
     * @private
     * @returns The name of the items in this queue.
     */
    protected getType(): string;
    /**
     * Sends a batch of modAck requests. Each deadline requires its own request,
     * so we have to group all the ackIds by deadline and send multiple requests.
     *
     * @private
     *
     * @param {Array.<Array.<string|number>>} batch Array of ackIds and deadlines.
     * @return {Promise}
     */
    protected _sendBatch(batch: QueuedMessages): Promise<QueuedMessages>;
    protected shouldFailEarly(message: QueuedMessage): boolean;
}
