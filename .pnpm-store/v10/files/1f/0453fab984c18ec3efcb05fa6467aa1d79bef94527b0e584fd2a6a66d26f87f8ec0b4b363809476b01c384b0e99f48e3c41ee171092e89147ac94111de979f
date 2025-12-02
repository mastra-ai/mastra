"use strict";
/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
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
exports.Publisher = exports.flowControlDefaults = exports.BATCH_LIMITS = void 0;
const extend = require("extend");
const api_1 = require("@opentelemetry/api");
const message_queues_1 = require("./message-queues");
const default_options_1 = require("../default-options");
const tracing = require("../telemetry-tracing");
const flow_control_1 = require("./flow-control");
const util_1 = require("../util");
/**
 * @typedef PublishOptions
 * @property {BatchPublishOptions} [batching] The maximum number of bytes to
 *     buffer before sending a payload.
 * @property {FlowControlOptions} [publisherFlowControl] Publisher-side flow
 *     control settings. If this is undefined, Ignore will be the assumed action.
 * @property {object} [gaxOpts] Request configuration options, outlined
 *     {@link https://googleapis.github.io/gax-nodejs/interfaces/CallOptions.html|here.}
 * @property {boolean} [messageOrdering] If true, messages published with the
 * same order key in Message will be delivered to the subscribers in the order in which they
 *  are received by the Pub/Sub system. Otherwise, they may be delivered in
 * any order.
 */
exports.BATCH_LIMITS = {
    maxBytes: Math.pow(1024, 2) * 9,
    maxMessages: 1000,
};
exports.flowControlDefaults = {
    maxOutstandingBytes: undefined,
    maxOutstandingMessages: undefined,
};
/**
 * A Publisher object allows you to publish messages to a specific topic.
 *
 * @private
 * @class
 *
 * @see [Topics: publish API Documentation]{@link https://cloud.google.com/pubsub/docs/reference/rest/v1/projects.topics/publish}
 *
 * @param {Topic} topic The topic associated with this publisher.
 * @param {PublishOptions} [options] Configuration object.
 */
class Publisher {
    topic;
    settings;
    queue;
    orderedQueues;
    flowControl;
    constructor(topic, options) {
        this.flowControl = new flow_control_1.FlowControl(options?.flowControlOptions || exports.flowControlDefaults);
        this.setOptions(options);
        this.topic = topic;
        this.queue = new message_queues_1.Queue(this);
        this.orderedQueues = new Map();
    }
    flush(callback) {
        const definedCallback = callback ? callback : () => { };
        const toDrain = [this.queue, ...Array.from(this.orderedQueues.values())];
        const allDrains = Promise.all(toDrain.map(q => new Promise(resolve => {
            const flushResolver = () => {
                resolve();
                // flush() may be called more than once, so remove these
                // event listeners after we've completed flush().
                q.removeListener('drain', flushResolver);
            };
            q.on('drain', flushResolver);
        })));
        const allPublishes = Promise.all(toDrain.map(q => q.publishDrain()));
        allPublishes
            .then(() => allDrains)
            .then(() => {
            definedCallback(null);
        })
            .catch(definedCallback);
    }
    publish(data, attrsOrCb, callback) {
        const attributes = typeof attrsOrCb === 'object' ? attrsOrCb : {};
        callback = typeof attrsOrCb === 'function' ? attrsOrCb : callback;
        return this.publishMessage({ data, attributes }, callback);
    }
    publishMessage(message, callback) {
        const { data, attributes = {} } = message;
        // We must have at least one of:
        //   - `data` as a Buffer
        //   - `attributes` that are not empty
        if (data && !(data instanceof Uint8Array)) {
            throw new TypeError('Data must be in the form of a Buffer or Uint8Array.');
        }
        const keys = Object.keys(attributes);
        if (!data && keys.length === 0) {
            throw new TypeError('If data is undefined, at least one attribute must be present.');
        }
        for (const key of keys) {
            const value = attributes[key];
            if (typeof value !== 'string') {
                throw new TypeError(`All attributes must be in the form of a string.
\nInvalid value of type "${typeof value}" provided for "${key}".`);
            }
        }
        // Ensure that there's a parent span for subsequent publishes
        // to hang off of.
        this.getParentSpan(message, 'Publisher.publishMessage');
        if (!message.orderingKey) {
            this.queue.add(message, callback);
        }
        else {
            const key = message.orderingKey;
            if (!this.orderedQueues.has(key)) {
                const queue = new message_queues_1.OrderedQueue(this, key);
                this.orderedQueues.set(key, queue);
                queue.once('drain', () => this.orderedQueues.delete(key));
            }
            const queue = this.orderedQueues.get(key);
            queue.add(message, callback);
        }
    }
    /**
     * Indicates to the publisher that it is safe to continue publishing for the
     * supplied ordering key.
     *
     * @private
     *
     * @param {string} key The ordering key to continue publishing for.
     */
    resumePublishing(key) {
        const queue = this.orderedQueues.get(key);
        if (queue) {
            queue.resumePublishing();
        }
    }
    /**
     * Returns the set of default options used for {@link Publisher}. The
     * returned value is a copy, and editing it will have no effect elsehwere.
     *
     * This is a non-static method to make it easier to access/stub.
     *
     * @private
     *
     * @returns {PublishOptions}
     */
    getOptionDefaults() {
        // Return a unique copy to avoid shenanigans.
        const defaults = {
            batching: {
                maxBytes: default_options_1.defaultOptions.publish.maxOutstandingBytes,
                maxMessages: default_options_1.defaultOptions.publish.maxOutstandingMessages,
                maxMilliseconds: default_options_1.defaultOptions.publish.maxDelayMillis,
            },
            messageOrdering: false,
            gaxOpts: {
                isBundling: false,
            },
            flowControlOptions: Object.assign({}, exports.flowControlDefaults),
        };
        return defaults;
    }
    /**
     * Sets the Publisher options.
     *
     * @private
     *
     * @param {PublishOptions} options The publisher options.
     */
    setOptions(options = {}) {
        const defaults = this.getOptionDefaults();
        const { batching, gaxOpts, messageOrdering, flowControlOptions } = extend(true, defaults, options);
        this.settings = {
            batching: {
                maxBytes: Math.min(batching.maxBytes, exports.BATCH_LIMITS.maxBytes),
                maxMessages: Math.min(batching.maxMessages, exports.BATCH_LIMITS.maxMessages),
                maxMilliseconds: batching.maxMilliseconds,
            },
            gaxOpts,
            messageOrdering,
            flowControlOptions,
        };
        // We also need to let all of our queues know that they need to update their options.
        // Note that these might be undefined, because setOptions() is called in the constructor.
        if (this.queue) {
            this.queue.updateOptions();
        }
        if (this.orderedQueues) {
            for (const q of this.orderedQueues.values()) {
                q.updateOptions();
            }
        }
        // This will always be filled in by our defaults if nothing else.
        this.flowControl.setOptions(this.settings.flowControlOptions);
    }
    /**
     * Finds or constructs an telemetry publish/parent span for a message.
     *
     * @private
     *
     * @param {PubsubMessage} message The message to create a span for
     */
    getParentSpan(message, caller) {
        const enabled = tracing.isEnabled();
        if (!enabled) {
            return undefined;
        }
        if (message.parentSpan) {
            return message.parentSpan;
        }
        const span = tracing.PubsubSpans.createPublisherSpan(message, this.topic.name, caller);
        // If the span's context is valid we should inject the propagation trace context.
        if (span && (0, api_1.isSpanContextValid)(span.spanContext())) {
            tracing.injectSpan(span, message);
        }
        return span;
    }
}
exports.Publisher = Publisher;
(0, util_1.promisifySome)(Publisher, Publisher.prototype, ['flush', 'publishMessage'], {
    singular: true,
});
//# sourceMappingURL=index.js.map