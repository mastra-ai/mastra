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
exports.MessageStream = exports.ChannelError = exports.StatusError = exports.logs = void 0;
const promisify_1 = require("@google-cloud/promisify");
const google_gax_1 = require("google-gax");
const isStreamEnded = require("is-stream-ended");
const stream_1 = require("stream");
const pull_retry_1 = require("./pull-retry");
const default_options_1 = require("./default-options");
const temporal_1 = require("./temporal");
const exponential_retry_1 = require("./exponential-retry");
const debug_1 = require("./debug");
const logs_1 = require("./logs");
/**
 * Loggers. Exported for unit tests.
 *
 * @private
 */
exports.logs = {
    subscriberStreams: logs_1.logs.pubsub.sublog('subscriber-streams'),
};
/*!
 * Frequency to ping streams.
 */
const KEEP_ALIVE_INTERVAL = 30000;
/*!
 * Deadline for the stream.
 */
const PULL_TIMEOUT = require('./v1/subscriber_client_config.json').interfaces['google.pubsub.v1.Subscriber'].methods.StreamingPull.timeout_millis;
/*!
 * default stream options
 */
const DEFAULT_OPTIONS = {
    highWaterMark: 0,
    maxStreams: default_options_1.defaultOptions.subscription.maxStreams,
    timeout: 300000,
    retryMinBackoff: temporal_1.Duration.from({ milliseconds: 100 }),
    retryMaxBackoff: temporal_1.Duration.from({ seconds: 60 }),
};
/**
 * Error wrapper for gRPC status objects.
 *
 * @class
 *
 * @param {object} status The gRPC status object.
 */
class StatusError extends Error {
    code;
    details;
    metadata;
    constructor(status) {
        super(status.details);
        this.code = status.code;
        this.details = status.details;
        this.metadata = status.metadata;
    }
}
exports.StatusError = StatusError;
/**
 * Error thrown when we fail to open a channel for the message stream.
 *
 * @class
 *
 * @param {Error} err The original error.
 */
class ChannelError extends Error {
    code;
    details;
    metadata;
    constructor(err) {
        super(`Failed to connect to channel. Reason: ${process.env.DEBUG_GRPC ? err.stack : err.message}`);
        this.code = err.message.includes('deadline')
            ? google_gax_1.grpc.status.DEADLINE_EXCEEDED
            : google_gax_1.grpc.status.UNKNOWN;
        this.details = err.message;
        this.metadata = new google_gax_1.grpc.Metadata();
    }
}
exports.ChannelError = ChannelError;
/**
 * Streaming class used to manage multiple StreamingPull requests.
 *
 * @private
 * @class
 *
 * @param {Subscriber} sub The parent subscriber.
 * @param {MessageStreamOptions} [options] The message stream options.
 */
class MessageStream extends stream_1.PassThrough {
    _keepAliveHandle;
    _options;
    _retrier;
    _streams;
    _subscriber;
    constructor(sub, options = {}) {
        options = Object.assign({}, DEFAULT_OPTIONS, options);
        super({ objectMode: true, highWaterMark: options.highWaterMark });
        this._options = options;
        this._retrier = new exponential_retry_1.ExponentialRetry(options.retryMinBackoff, // Filled by DEFAULT_OPTIONS
        options.retryMaxBackoff);
        this._streams = [];
        for (let i = 0; i < options.maxStreams; i++) {
            this._streams.push({});
        }
        this._subscriber = sub;
    }
    /**
     * Actually starts the stream setup and subscription pulls.
     * This is separated so that others can properly wait on the promise.
     *
     * @private
     */
    async start() {
        await this._fillStreamPool();
        this._keepAliveHandle = setInterval(() => this._keepAlive(), KEEP_ALIVE_INTERVAL);
        this._keepAliveHandle.unref();
    }
    /**
     * Updates the stream ack deadline with the server.
     *
     * @param {Duration} deadline The new deadline value to set.
     */
    setStreamAckDeadline(deadline) {
        const request = {
            streamAckDeadlineSeconds: deadline.totalOf('second'),
        };
        for (const tracker of this._streams) {
            // We don't need a callback on this one, it's advisory.
            if (tracker.stream) {
                tracker.stream.write(request);
            }
        }
    }
    /**
     * Destroys the stream and any underlying streams.
     *
     * @param {error?} error An error to emit, if any.
     * @param {Function} callback Callback for completion of any destruction.
     * @private
     */
    _destroy(error, callback) {
        if (this._keepAliveHandle) {
            clearInterval(this._keepAliveHandle);
        }
        this._retrier.close();
        for (let i = 0; i < this._streams.length; i++) {
            const tracker = this._streams[i];
            if (tracker.stream) {
                this._removeStream(i, 'overall message stream destroyed', 'n/a');
            }
        }
        callback(error);
    }
    /**
     * Adds a StreamingPull stream to the combined stream.
     *
     * @private
     *
     * @param {stream} stream The StreamingPull stream.
     */
    _replaceStream(index, stream, reason) {
        this._removeStream(index, reason, 'stream replacement');
        this._setHighWaterMark(stream);
        const tracker = this._streams[index];
        tracker.stream = stream;
        tracker.receivedStatus = false;
        stream
            .on('error', err => this._onError(index, err))
            .once('status', status => this._onStatus(index, status))
            .on('data', (data) => this._onData(index, data));
    }
    _onData(index, data) {
        // Mark this stream as alive again. (reset backoff)
        const tracker = this._streams[index];
        this._retrier.reset(tracker);
        this.emit('data', data);
    }
    /**
     * Attempts to create and cache the desired number of StreamingPull requests.
     * gRPC does not supply a way to confirm that a stream is connected, so our
     * best bet is to open the streams and use the client.waitForReady() method to
     * confirm everything is ok.
     *
     * @private
     *
     * @returns {Promise}
     */
    async _fillStreamPool() {
        if (this.destroyed) {
            return;
        }
        let client;
        try {
            client = await this._getClient();
        }
        catch (e) {
            const err = e;
            this.destroy(err);
        }
        const all = [];
        for (let i = 0; i < this._streams.length; i++) {
            all.push(this._fillOne(i, client, 'initial fill'));
        }
        await Promise.all(all);
        try {
            await this._waitForClientReady(client);
        }
        catch (e) {
            const err = e;
            this.destroy(err);
        }
    }
    async _fillOne(index, client, reason) {
        if (this.destroyed) {
            exports.logs.subscriberStreams.info('not filling stream %i for reason "%s" because already shut down', index, reason);
            return;
        }
        const tracker = this._streams[index];
        if (tracker.stream) {
            return;
        }
        if (!client) {
            try {
                client = await this._getClient();
            }
            catch (e) {
                exports.logs.subscriberStreams.error('unable to create stream %i: %o', index, e);
                const err = e;
                this.destroy(err);
                return;
            }
        }
        const deadline = Date.now() + PULL_TIMEOUT;
        const request = {
            subscription: this._subscriber.name,
            streamAckDeadlineSeconds: this._subscriber.ackDeadline,
            maxOutstandingMessages: this._subscriber.useLegacyFlowControl
                ? 0
                : this._subscriber.maxMessages,
            maxOutstandingBytes: this._subscriber.useLegacyFlowControl
                ? 0
                : this._subscriber.maxBytes,
        };
        const otherArgs = {
            headers: {
                'x-goog-request-params': 'subscription=' + this._subscriber.name,
            },
        };
        const stream = client.streamingPull({ deadline, otherArgs });
        this._replaceStream(index, stream, reason);
        stream.write(request);
    }
    /**
     * It is critical that we keep as few `PullResponse` objects in memory as
     * possible to reduce the number of potential redeliveries. Because of this we
     * want to bypass gax for StreamingPull requests to avoid creating a Duplexify
     * stream, doing so essentially doubles the size of our readable buffer.
     *
     * @private
     *
     * @returns {Promise.<object>}
     */
    async _getClient() {
        const client = await this._subscriber.getClient();
        await client.initialize();
        return client.subscriberStub;
    }
    /**
     * Since we do not use the streams to ack/modAck messages, they will close
     * by themselves unless we periodically send empty messages.
     *
     * @private
     */
    _keepAlive() {
        exports.logs.subscriberStreams.info('sending keepAlive to %i streams', this._streams.length);
        this._streams.forEach(tracker => {
            // It's possible that a status event fires off (signaling the rpc being
            // closed) but the stream hasn't drained yet. Writing to such a stream will
            // result in a `write after end` error.
            if (!tracker.receivedStatus && tracker.stream) {
                tracker.stream.write({});
            }
        });
    }
    // Returns the number of tracked streams that contain an actual stream (good or not).
    _activeStreams() {
        return this._streams.reduce((p, t) => (t.stream ? 1 : 0) + p, 0);
    }
    /**
     * Once the stream has nothing left to read, we'll remove it and attempt to
     * refill our stream pool if needed.
     *
     * @private
     *
     * @param {number} index The ended stream.
     * @param {object} status The stream status.
     */
    _onEnd(index, status) {
        const willRetry = pull_retry_1.PullRetry.retry(status);
        this._removeStream(index, 'stream was closed', willRetry ? 'will be retried' : 'will not be retried');
        const statusError = new StatusError(status);
        if (willRetry) {
            const message = `Subscriber stream ${index} has ended with status ${status.code}; will be retried.`;
            exports.logs.subscriberStreams.info('%s', message);
            this.emit('debug', new debug_1.DebugMessage(message, statusError));
            if (pull_retry_1.PullRetry.resetFailures(status)) {
                this._retrier.reset(this._streams[index]);
            }
            this._retrier.retryLater(this._streams[index], () => this._fillOne(index, undefined, 'retry'));
        }
        else if (this._activeStreams() === 0) {
            const message = `Subscriber stream ${index} has ended with status ${status.code}; will not be retried.`;
            exports.logs.subscriberStreams.info('%s', message);
            this.emit('debug', new debug_1.DebugMessage(message, statusError));
            // No streams left, and nothing to retry.
            this.destroy(new StatusError(status));
        }
    }
    /**
     * gRPC will usually emit a status as a ServiceError via `error` event before
     * it emits the status itself. In order to cut back on emitted errors, we'll
     * wait a tick on error and ignore it if the status has been received.
     *
     * @private
     *
     * @param {number} index The stream that errored.
     * @param {Error} err The error.
     */
    async _onError(index, err) {
        await (0, promisify_1.promisify)(process.nextTick)();
        const code = err.code;
        const tracker = this._streams[index];
        const receivedStatus = !tracker.stream || (tracker.stream && !tracker.receivedStatus);
        // For the user-cancelled errors, we don't need to show those, we're handling
        // notifying of us closing the stream elsewhere.
        if (err.code !== google_gax_1.grpc.status.CANCELLED) {
            exports.logs.subscriberStreams.error('error on stream %i: %o', index, err);
        }
        if (typeof code !== 'number' || !receivedStatus) {
            this.emit('error', err);
        }
    }
    /**
     * gRPC streams will emit a status event once the connection has been
     * terminated. This is preferable to end/close events because we'll receive
     * information as to why the stream closed and if it is safe to open another.
     *
     * @private
     *
     * @param {stream} stream The stream that was closed.
     * @param {object} status The status message stating why it was closed.
     */
    _onStatus(index, status) {
        if (this.destroyed) {
            return;
        }
        const tracker = this._streams[index];
        tracker.receivedStatus = true;
        if (!tracker.stream) {
            // This shouldn't really happen, but in case wires get crossed.
            return;
        }
        if (isStreamEnded(tracker.stream)) {
            this._onEnd(index, status);
        }
        else {
            tracker.stream.once('end', () => this._onEnd(index, status));
            tracker.stream.push(null);
        }
    }
    /**
     * Removes a stream from the combined stream.
     *
     * @private
     *
     * @param {number} index The stream to remove.
     */
    _removeStream(index, reason, whatNext) {
        const tracker = this._streams[index];
        if (tracker.stream) {
            exports.logs.subscriberStreams.info('closing stream %i; why: %s; next: %s', index, reason, whatNext);
            tracker.stream.unpipe(this);
            tracker.stream.cancel();
            tracker.stream = undefined;
            tracker.receivedStatus = undefined;
        }
    }
    /**
     * Neither gRPC nor gax allow for the highWaterMark option to be specified.
     * However using the default value (16) it is possible to end up with a lot of
     * PullResponse objects stored in internal buffers. If this were to happen
     * and the client were slow to process messages, we could potentially see a
     * very large number of redeliveries happen before the messages even made it
     * to the client.
     *
     * @private
     *
     * @param {Duplex} stream The duplex stream to adjust the
     *     highWaterMarks for.
     */
    _setHighWaterMark(stream) {
        stream._readableState.highWaterMark = this._options.highWaterMark;
    }
    /**
     * Promisified version of gRPC's Client#waitForReady function.
     *
     * @private
     *
     * @param {object} client The gRPC client to wait for.
     * @returns {Promise}
     */
    async _waitForClientReady(client) {
        const deadline = Date.now() + this._options.timeout;
        try {
            await (0, promisify_1.promisify)(client.waitForReady).call(client, deadline);
        }
        catch (e) {
            const err = e;
            throw new ChannelError(err);
        }
    }
}
exports.MessageStream = MessageStream;
//# sourceMappingURL=message-stream.js.map