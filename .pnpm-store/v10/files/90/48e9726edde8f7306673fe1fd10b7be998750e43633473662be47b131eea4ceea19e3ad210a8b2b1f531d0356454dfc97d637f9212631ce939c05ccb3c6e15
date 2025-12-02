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
exports.ModAckQueue = exports.AckQueue = exports.MessageQueue = exports.BatchError = exports.MAX_BATCH_BYTES = exports.logs = void 0;
const google_gax_1 = require("google-gax");
const defer = require("p-defer");
const ack_metadata_1 = require("./ack-metadata");
const exponential_retry_1 = require("./exponential-retry");
const subscriber_1 = require("./subscriber");
const temporal_1 = require("./temporal");
const util_1 = require("./util");
const debug_1 = require("./debug");
const tracing = require("./telemetry-tracing");
const logs_1 = require("./logs");
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
exports.logs = {
    ackBatch: logs_1.logs.pubsub.sublog('ack-batch'),
};
// This is the maximum number of bytes we will send for a batch of
// ack/modack messages. The server itself has a maximum of 512KiB, so
// we just pull back a little from that in case of unknown fenceposts.
exports.MAX_BATCH_BYTES = 510 * 1024;
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
class BatchError extends debug_1.DebugMessage {
    ackIds;
    code;
    details;
    constructor(err, ackIds, rpc) {
        super(`Failed to "${rpc}" for ${ackIds.length} message(s). Reason: ${process.env.DEBUG_GRPC ? err.stack : err.message}`, err);
        this.ackIds = ackIds;
        this.code = err.code;
        this.details = err.message;
    }
}
exports.BatchError = BatchError;
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
class MessageQueue {
    numPendingRequests;
    numInFlightRequests;
    numInRetryRequests;
    bytes;
    _onFlush;
    _onDrain;
    _options;
    _requests;
    _subscriber;
    _timer;
    _retrier;
    _closed = false;
    constructor(sub, options = {}) {
        this.numPendingRequests = 0;
        this.numInFlightRequests = 0;
        this.numInRetryRequests = 0;
        this.bytes = 0;
        this._requests = [];
        this._subscriber = sub;
        this._retrier = new exponential_retry_1.ExponentialRetry(temporal_1.Duration.from({ seconds: 1 }), temporal_1.Duration.from({ seconds: 64 }));
        this.setOptions(options);
    }
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
    close() {
        let requests = this._requests;
        this._requests = [];
        this.numInFlightRequests = this.numPendingRequests = 0;
        requests = requests.concat(this._retrier.close());
        const isExactlyOnceDelivery = this._subscriber.isExactlyOnceDelivery;
        requests.forEach(r => {
            if (r.responsePromise) {
                if (isExactlyOnceDelivery) {
                    r.responsePromise.reject(new subscriber_1.AckError(subscriber_1.AckResponses.Invalid, 'Subscriber closed'));
                }
                else {
                    r.responsePromise.resolve();
                }
            }
        });
        this._closed = true;
    }
    /**
     * Gets the default buffer time in ms.
     *
     * @returns {number}
     * @private
     */
    get maxMilliseconds() {
        return this._options.maxMilliseconds;
    }
    /*!
     * Logs about a batch being sent, and why.
     * @private
     */
    logBatch(reason) {
        exports.logs.ackBatch.info('%s triggered %s batch of %i messages, a total of %i bytes', reason, this.getType(), this._requests.length, this.bytes);
    }
    /**
     * Adds a message to the queue.
     *
     * @param {Message} message The message to add.
     * @param {number} [deadline] The deadline in seconds.
     * @private
     */
    async add(message, deadline) {
        if (this._closed) {
            if (this._subscriber.isExactlyOnceDelivery) {
                throw new subscriber_1.AckError(subscriber_1.AckResponses.Invalid, 'Subscriber closed');
            }
            else {
                return;
            }
        }
        const { maxMessages, maxMilliseconds } = this._options;
        const size = Buffer.byteLength(message.ackId, 'utf8');
        // If we will go over maxMessages or MAX_BATCH_BYTES by adding this
        // message, flush first. (maxMilliseconds is handled by timers.)
        if (this._requests.length + 1 >= maxMessages ||
            this.bytes + size >= exports.MAX_BATCH_BYTES) {
            const reason = this._requests.length + 1 >= maxMessages
                ? 'going over count'
                : 'going over size';
            await this.flush(reason);
        }
        // Add the message to the current batch.
        const responsePromise = defer();
        this._requests.push({
            message: {
                ackId: message.ackId,
                tracingSpan: message.parentSpan,
            },
            deadline,
            responsePromise,
            retryCount: 0,
        });
        this.numPendingRequests++;
        this.numInFlightRequests++;
        this.bytes += size;
        // Ensure that we are counting toward maxMilliseconds by timer.
        if (!this._timer) {
            this._timer = setTimeout(() => this.flush('batch timer'), maxMilliseconds);
        }
        return responsePromise.promise;
    }
    /**
     * Retry handler for acks/modacks that have transient failures. Unless
     * it's passed the final deadline, we will just re-queue it for sending.
     *
     * @private
     */
    handleRetry(message, totalTime) {
        // Has it been too long?
        if (totalTime.totalOf('minute') >= 10 || this.shouldFailEarly(message)) {
            message.responsePromise?.reject(new subscriber_1.AckError(subscriber_1.AckResponses.Invalid, 'Retried for too long'));
            return;
        }
        // Just throw it in for another round of processing on the next batch.
        this._requests.push(message);
        this.numPendingRequests++;
        this.numInFlightRequests++;
        this.numInRetryRequests--;
        // Make sure we actually do have another batch scheduled.
        if (!this._timer) {
            this._timer = setTimeout(() => this.flush('retry timer'), this._options.maxMilliseconds);
        }
    }
    /**
     * This hook lets a subclass tell the retry handler to go ahead and fail early.
     *
     * @private
     */
    shouldFailEarly(message) {
        message;
        return false;
    }
    /**
     * Sends a batch of messages.
     * @private
     */
    async flush(reason) {
        if (reason) {
            this.logBatch(reason);
        }
        if (this._timer) {
            clearTimeout(this._timer);
            delete this._timer;
        }
        const batch = this._requests;
        const batchSize = batch.length;
        const deferred = this._onFlush;
        this._requests = [];
        this.bytes = 0;
        this.numPendingRequests -= batchSize;
        delete this._onFlush;
        try {
            const toRetry = await this._sendBatch(batch);
            // We'll get back anything that needs a retry for transient errors.
            for (const m of toRetry) {
                this.numInRetryRequests++;
                m.retryCount++;
                this._retrier.retryLater(m, this.handleRetry.bind(this));
            }
        }
        catch (e) {
            // These queues are used for ack and modAck messages, which should
            // never surface an error to the user level. However, we'll emit
            // them onto this debug channel in case debug info is needed.
            const err = e;
            const debugMsg = new debug_1.DebugMessage(err.message, err);
            this._subscriber.emit('debug', debugMsg);
        }
        this.numInFlightRequests -= batchSize;
        if (deferred) {
            deferred.resolve();
        }
        if (this.numInFlightRequests <= 0 &&
            this.numInRetryRequests <= 0 &&
            this._onDrain) {
            this._onDrain.resolve();
            delete this._onDrain;
        }
    }
    /**
     * Returns a promise that resolves after the next flush occurs.
     *
     * @returns {Promise}
     * @private
     */
    onFlush() {
        if (!this._onFlush) {
            this._onFlush = defer();
        }
        return this._onFlush.promise;
    }
    /**
     * Returns a promise that resolves when all in-flight messages have settled.
     */
    onDrain() {
        if (!this._onDrain) {
            this._onDrain = defer();
        }
        return this._onDrain.promise;
    }
    /**
     * Set the batching options.
     *
     * @param {BatchOptions} options Batching options.
     * @private
     */
    setOptions(options) {
        const defaults = {
            maxMessages: 3000,
            maxMilliseconds: 100,
        };
        this._options = Object.assign(defaults, options);
    }
    /**
     * Succeed a whole batch of Acks/Modacks for an OK RPC response.
     *
     * @private
     */
    handleAckSuccesses(batch) {
        // Everyone gets a resolve!
        batch.forEach(({ responsePromise }) => {
            responsePromise?.resolve();
        });
    }
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
    handleAckFailures(operation, batch, rpcError) {
        const toSucceed = [];
        const toRetry = [];
        const toError = new Map([
            [subscriber_1.AckResponses.PermissionDenied, []],
            [subscriber_1.AckResponses.FailedPrecondition, []],
            [subscriber_1.AckResponses.Other, []],
        ]);
        // Parse any error codes, both for the RPC call and the ErrorInfo.
        const error = rpcError.code
            ? (0, ack_metadata_1.processAckRpcError)(rpcError.code)
            : undefined;
        const codes = (0, ack_metadata_1.processAckErrorInfo)(rpcError);
        for (const m of batch) {
            if (codes.has(m.message.ackId)) {
                // This ack has an ErrorInfo entry, so use that to route it.
                const code = codes.get(m.message.ackId);
                if (code.transient) {
                    // Transient errors get retried.
                    toRetry.push(m);
                }
                else {
                    // It's a permanent error.
                    (0, util_1.addToBucket)(toError, code.response, m);
                }
            }
            else if (error !== undefined) {
                // This ack doesn't have an ErrorInfo entry, but we do have an RPC
                // error, so use that to route it.
                if (error.transient) {
                    toRetry.push(m);
                }
                else {
                    (0, util_1.addToBucket)(toError, error.response, m);
                }
            }
            else {
                // Looks like this one worked out.
                toSucceed.push(m);
            }
        }
        // To remain consistent with previous behaviour, we will push a debug
        // stream message if an unknown error happens during ack.
        const others = toError.get(subscriber_1.AckResponses.Other);
        if (others?.length) {
            const otherIds = others.map(e => e.message.ackId);
            const debugMsg = new BatchError(rpcError, otherIds, operation);
            this._subscriber.emit('debug', debugMsg);
        }
        // Take care of following up on all the Promises.
        toSucceed.forEach(m => {
            m.responsePromise?.resolve();
        });
        for (const e of toError.entries()) {
            e[1].forEach(m => {
                const exc = new subscriber_1.AckError(e[0], rpcError.message);
                m.responsePromise?.reject(exc);
            });
        }
        return {
            toError,
            toRetry,
        };
    }
    /**
     * Since we handle our own retries for ack/modAck calls when exactly-once
     * delivery is enabled on a subscription, we conditionally need to disable
     * the gax retries. This returns an appropriate CallOptions for the
     * subclasses to pass down.
     *
     * @private
     */
    getCallOptions() {
        let callOptions = this._options.callOptions;
        if (this._subscriber.isExactlyOnceDelivery) {
            // If exactly-once-delivery is enabled, tell gax not to do retries for us.
            callOptions = Object.assign({}, callOptions ?? {});
            callOptions.retry = new google_gax_1.RetryOptions([], {
                initialRetryDelayMillis: 0,
                retryDelayMultiplier: 0,
                maxRetryDelayMillis: 0,
            });
        }
        return callOptions;
    }
}
exports.MessageQueue = MessageQueue;
/**
 * Queues up Acknowledge (ack) requests.
 *
 * @private
 * @class
 */
class AckQueue extends MessageQueue {
    /**
     * @private
     * @returns The name of the items in this queue.
     */
    getType() {
        return 'ack';
    }
    /**
     * Sends a batch of ack requests.
     *
     * @private
     *
     * @param {Array.<Array.<string|number>>} batch Array of ackIds and deadlines.
     * @return {Promise}
     */
    async _sendBatch(batch) {
        const responseSpan = tracing.PubsubSpans.createAckRpcSpan(batch.map(b => b.message.tracingSpan), this._subscriber.name, 'AckQueue._sendBatch');
        const client = await this._subscriber.getClient();
        const ackIds = batch.map(({ message }) => message.ackId);
        const reqOpts = { subscription: this._subscriber.name, ackIds };
        try {
            await client.acknowledge(reqOpts, this.getCallOptions());
            // It's okay if these pass through since they're successful anyway.
            this.handleAckSuccesses(batch);
            responseSpan?.end();
            return [];
        }
        catch (e) {
            // If exactly-once delivery isn't enabled, don't do error processing. We'll
            // emulate previous behaviour by resolving all pending Promises with
            // a success status, and then throwing a BatchError for debug logging.
            if (!this._subscriber.isExactlyOnceDelivery) {
                batch.forEach(m => {
                    m.responsePromise?.resolve();
                });
                throw new BatchError(e, ackIds, 'ack');
            }
            else {
                const grpcError = e;
                try {
                    const results = this.handleAckFailures('ack', batch, grpcError);
                    return results.toRetry;
                }
                catch (e) {
                    // This should only ever happen if there's a code failure.
                    const err = e;
                    this._subscriber.emit('debug', new debug_1.DebugMessage(err.message, err));
                    const exc = new subscriber_1.AckError(subscriber_1.AckResponses.Other, 'Code error');
                    batch.forEach(m => {
                        m.responsePromise?.reject(exc);
                    });
                    responseSpan?.end();
                    return [];
                }
            }
        }
    }
}
exports.AckQueue = AckQueue;
/**
 * Queues up ModifyAckDeadline requests and sends them out in batches.
 *
 * @private
 * @class
 */
class ModAckQueue extends MessageQueue {
    /**
     * @private
     * @returns The name of the items in this queue.
     */
    getType() {
        return 'modack/nack';
    }
    /**
     * Sends a batch of modAck requests. Each deadline requires its own request,
     * so we have to group all the ackIds by deadline and send multiple requests.
     *
     * @private
     *
     * @param {Array.<Array.<string|number>>} batch Array of ackIds and deadlines.
     * @return {Promise}
     */
    async _sendBatch(batch) {
        const client = await this._subscriber.getClient();
        const subscription = this._subscriber.name;
        const modAckTable = batch.reduce((table, message) => {
            if (!table[message.deadline]) {
                table[message.deadline] = [];
            }
            table[message.deadline].push(message);
            return table;
        }, {});
        const callOptions = this.getCallOptions();
        const modAckRequests = Object.keys(modAckTable).map(async (deadline) => {
            const messages = modAckTable[deadline];
            const ackIds = messages.map(m => m.message.ackId);
            const ackDeadlineSeconds = Number(deadline);
            const reqOpts = { subscription, ackIds, ackDeadlineSeconds };
            const responseSpan = tracing.PubsubSpans.createModackRpcSpan(messages.map(b => b.message.tracingSpan), this._subscriber.name, ackDeadlineSeconds === 0 ? 'nack' : 'modack', 'ModAckQueue._sendBatch', temporal_1.Duration.from({ seconds: ackDeadlineSeconds }));
            try {
                await client.modifyAckDeadline(reqOpts, callOptions);
                responseSpan?.end();
                // It's okay if these pass through since they're successful anyway.
                this.handleAckSuccesses(messages);
                return [];
            }
            catch (e) {
                // If exactly-once delivery isn't enabled, don't do error processing. We'll
                // emulate previous behaviour by resolving all pending Promises with
                // a success status, and then throwing a BatchError for debug logging.
                if (!this._subscriber.isExactlyOnceDelivery) {
                    batch.forEach(m => {
                        m.responsePromise?.resolve();
                    });
                    throw new BatchError(e, ackIds, 'modAck');
                }
                else {
                    const grpcError = e;
                    const newBatch = this.handleAckFailures('modAck', messages, grpcError);
                    return newBatch.toRetry;
                }
            }
        });
        // This catches the sub-failures and bubbles up anything we need to bubble.
        const allNewBatches = await Promise.all(modAckRequests);
        return allNewBatches.reduce((p, c) => [
            ...(p ?? []),
            ...c,
        ]);
    }
    // For modacks only, we'll stop retrying after 3 tries.
    shouldFailEarly(message) {
        return message.retryCount >= 3;
    }
}
exports.ModAckQueue = ModAckQueue;
//# sourceMappingURL=message-queues.js.map